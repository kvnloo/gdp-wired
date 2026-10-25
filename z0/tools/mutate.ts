// Mutate only compiled implementation values. Laws are never rewritten for machine cases.
import {type C, type E, type Machine, type State, type Request, evalC, interpret, loadJs, numbersOf, seeded} from '../../core/machine.ts'
import {funOf, proveDecision} from '../../core/dsl.ts'
import {clock, withDeadline, proveStepLaws} from '../../kernel/prove.ts'
import {decisionMutation} from './decisions.ts'
import {allowed, watch} from '../../core/watch.ts'
import type {Case, RuleCase} from '../../examples/harness.ts'

export type Edit = {path: (string | number)[], operator: string, before: E | C, after: E | C}
export type Options = {cap: number, seed: number, trials: number, depth: number, bound: number}
export const defaults: Options = {cap: 200, seed: 1, trials: 200, depth: 12, bound: 4}
const empty: State = {scalars: {}, maps: {}}
const text = (v: unknown): string => JSON.stringify(v, (_k, x) => x instanceof Map ? [...x.entries()].sort((a, b) => a[0] - b[0]) : x)

// Traversal order is stable and no candidate changes more than one expression site.
export function edits(t: E | C, path: Edit['path'] = []): Edit[] {
  const out: Edit[] = []
  const add = (operator: string, after: E | C) => { if (text(t) !== text(after)) out.push({path, operator, before: t, after}) }
  switch (t.op) {
    case '<': add('comparison:<→<=', {...t, op: '<='}); break
    case '<=': add('comparison:<=→<', {...t, op: '<'}); break
    case '=': add('comparison:=→<=', {...t, op: '<='}); break
    case 'add': add('arithmetic:add→sub', {...t, op: 'sub'}); break
    case 'sub': add('arithmetic:sub→add', {...t, op: 'add'}); break
    case 'min': add('extremum:min→max', {...t, op: 'max'}); break
    case 'max': add('extremum:max→min', {...t, op: 'min'}); break
    case 'and':
    case 'or':
      add(`boolean:${t.op}→${t.op === 'and' ? 'or' : 'and'}`, {...t, op: t.op === 'and' ? 'or' : 'and'})
      if (t.op === 'and') t.xs.forEach((_x, i) => add(`drop-conjunct:${i}`, {...t, xs: t.xs.filter((_y, j) => j !== i)}))
      break
    case 'not': add('remove-not', t.x); break
    case 'if': add('swap-branches', {...t, then: t.else, else: t.then}); break
    case 'const':
      if (Number.isSafeInteger(t.value + 1)) add('constant:+1', {...t, value: t.value + 1})
      if (t.value > 0) add('constant:-1', {...t, value: t.value - 1})
      break
  }
  if (['<', '<=', '=', 'and', 'or', 'flag', 'all'].includes(t.op)) add('insert-not', {op: 'not', x: t as C})
  for (const [key, value] of Object.entries(t)) {
    if (Array.isArray(value)) value.forEach((x, i) => { if (x && typeof x === 'object' && 'op' in x) out.push(...edits(x, [...path, key, i])) })
    else if (value && typeof value === 'object' && 'op' in value) out.push(...edits(value, [...path, key]))
  }
  return out
}

function replace<T>(value: T, path: Edit['path'], after: unknown): T {
  if (!path.length) return after as T // validated expression edit boundary
  const [head, ...tail] = path
  if (Array.isArray(value)) return value.map((x, i) => i === head ? replace(x, tail, after) : x) as T
  if (!value || typeof value !== 'object') throw new Error('invalid mutation path')
  return Object.fromEntries(Object.entries(value).map(([k, x]) => [k, k === head ? replace(x, tail, after) : x])) as T
}
export function machineEdits(m: Machine): Edit[] {
  const out: Edit[] = []
  const root = (t: E | C, path: Edit['path']) => out.push(...edits(t, path))
  for (const [n, c] of Object.entries(m.step.flags ?? {})) root(c, ['step', 'flags', n])
  if (m.assume) root(m.assume, ['assume'])
  for (const [n, e] of Object.entries(m.step.state ?? {})) {
    root(e, ['step', 'state', n])
    const identity: E = {op: 'var', name: n}
    if (text(identity) !== text(e)) out.push({path: ['step', 'state', n], operator: 'identity-update', before: e, after: identity})
  }
  for (const [n, u] of Object.entries(m.step.maps ?? {})) {
    if ('key' in u) root(u.key, ['step', 'maps', n, 'key'])
    root(u.value, ['step', 'maps', n, 'value'])
    const identity: E = {op: 'get', map: n, key: 'key' in u ? u.key : {op: 'var', name: u.each}}
    if (text(identity) !== text(u.value)) out.push({path: ['step', 'maps', n, 'value'], operator: 'identity-update', before: u.value, after: identity})
  }
  if (m.history) root(m.history.keep, ['history', 'keep'])
  return out
}

// Same drawn requests, with acceptance/refusal, flags, all scalars/maps/defaults/history observed.
function exercise(c: RuleCase, original: Machine, mutant: Machine, opts: Options) {
  const rng = seeded(opts.seed), a = interpret(original), b = interpret(mutant), generated = loadJs(mutant)
  let runs = 0, steps = 0, differs = false
  const kills: Record<string, {params: Record<string, number>, trace: Request[]}> = {}
  for (let trial = 0; trial < opts.trials; trial++) {
    const params = c.rule.randomParams(rng, opts.bound)
    if (original.pre && !evalC(original.pre, params, empty, original)) continue
    let sa = a.init(params), sb = b.init(params), sg = generated.init(params), trace: Request[] = []
    const monitors = [...c.laws, ...(c.steps ?? [])].map(l => ({name: l.name, on: watch(mutant, b, l, params, opts.bound)}))
    for (const w of monitors) if (!w.on.start(sb)) kills[w.name] ??= {params, trace: []}
    runs++
    for (let i = 0; i < opts.depth; i++) {
      const request = c.rule.randomInput(rng, opts.bound, params)
      if (c.rule.orderedBy) request[c.rule.orderedBy] = i
      const aa = allowed(original, a, params, sa, request), ab = allowed(mutant, b, params, sb, request)
      if (aa !== ab) differs = true
      if (!ab) { if (aa) sa = a.step(params, sa, request); continue }
      for (const name of Object.keys(mutant.step.flags ?? {})) {
        const flag: C = {op: 'flag', name}
        if (aa && evalC(flag, {...params, ...numbersOf(request)}, sa, original) !== evalC(flag, {...params, ...numbersOf(request)}, sb, mutant)) differs = true
      }
      const before = sb
      sb = b.step(params, sb, request); sg = generated.step(params, sg, request)
      if (text(sb) !== text(sg)) throw new Error('mutant compiled/interpreted mismatch')
      trace.push(request); steps++
      for (const w of monitors) if (!w.on.step(before, request, sb)) kills[w.name] ??= {params, trace: [...trace]}
      if (aa) { sa = a.step(params, sa, request); if (text(sa) !== text(sb)) differs = true }
    }
  }
  return {runs, steps, differs, kills}
}

export type Cell = {proven: boolean, checked: boolean, killed: boolean, witness?: unknown, error?: string}
export type MutantRow = {id: string, edit: Edit, status: 'killed' | 'survived' | 'unknown', likely_equivalent: boolean, observations: {runs: number, steps: number, differs: boolean}, laws: Record<string, Cell>, ms: number, error?: string}
export function summarize(rows: MutantRow[]) {
  const total = rows.length, killed = rows.filter(r => r.status === 'killed').length, survived = rows.filter(r => r.status === 'survived').length
  const likely_equivalent = rows.filter(r => r.likely_equivalent).length, unknown = total - killed - survived, denominator = total - likely_equivalent
  return {total, killed, survived, unknown, likely_equivalent, denominator, mutation_score: denominator ? killed / denominator : null}
}

export function mutateCase(c: Case, options: Partial<Options> = {}) {
  const opts = {...defaults, ...options}, start = performance.now()
  if (c.kind === 'loop') return {supported: false, reason: 'loop mutation is outside rule/decision scope', rows: [], summary: summarize([]), ms: 0}
  const rows: MutantRow[] = [], matrix: Record<string, Record<string, Cell>> = {}
  const source = c.kind === 'rule' ? c.rule.withSumsOf(c.laws, c.steps ?? []).machine : funOf(c.decisions[0]!)?.rule.machine
  if (!source) return {supported: false, reason: 'direct decision has no retained implementation boundary; refusing to mutate laws', rows, summary: summarize(rows), ms: 0}
  const candidates = machineEdits(source)
  for (const [index, edit] of candidates.slice(0, opts.cap).entries()) {
    const t0 = performance.now(), mutant = replace(source, edit.path, edit.after), id = `M${String(index + 1).padStart(4, '0')}`
    const names = c.kind === 'rule' ? [...c.laws, ...(c.steps ?? [])].map(l => l.name) : c.decisions.map(d => d.name)
    const row: MutantRow = {id, edit, status: 'unknown', likely_equivalent: false, observations: {runs: 0, steps: 0, differs: false}, laws: Object.fromEntries(names.map(name => [name, {proven: false, checked: false, killed: false, error: 'not evaluated'}])), ms: 0}
    try {
      if (c.kind === 'rule') {
        const prove = (laws: typeof c.laws, steps: NonNullable<typeof c.steps>) => withDeadline(clock() + 1000, () => proveStepLaws(mutant, laws, steps))
        const suite = prove(c.laws, c.steps ?? [])
        const runs = exercise(c, source, mutant, opts)
        row.observations = {runs: runs.runs, steps: runs.steps, differs: runs.differs}
        for (const law of [...c.laws, ...(c.steps ?? [])]) {
          // Keep all stated invariants as the inductive context for a step claim, not other step conclusions.
          const v = 'holds' in law ? prove([law], []) : prove(c.laws, [law])
          row.laws[law.name] = {proven: v.proven, checked: v.checked, killed: !!runs.kills[law.name], ...(runs.kills[law.name] ? {witness: runs.kills[law.name]} : {})}
        }
        row.status = Object.values(row.laws).some(l => l.killed) ? 'killed' : suite.proven && suite.checked ? 'survived' : 'unknown'
      } else {
        if (c.decisions.some(d => text(funOf(d)?.rule.machine) !== text(source))) throw new Error('multiple different functions in one decision case are unsupported')
        const ds = c.decisions.map(d => decisionMutation(d, mutant, edit.path)), rng = seeded(opts.seed)
        const f = funOf(c.decisions[0]!)!
        const observations = exercise({kind: 'rule', name: c.name, about: c.about, rule: f.rule, laws: [], broken: []}, source, mutant, {...opts, depth: 1})
        row.observations = {runs: observations.runs, steps: observations.steps, differs: observations.differs}
        for (const [i, d] of ds.entries()) {
          const v = proveDecision(d, {ms: 1000}), own = c.decisions[i]!
          const cell: Cell = {proven: v.proven, checked: v.checked, killed: false}
          for (let t = 0; t < opts.trials; t++) {
            const params = own.rule.randomParams(rng, opts.bound), request = own.rule.randomInput(rng, opts.bound, params)
            const env = {...params, ...numbersOf(request)}, st: State = {scalars: {}, maps: Object.fromEntries(Object.entries(request).filter((e): e is [string, ReadonlyMap<number, number>] => typeof e[1] !== 'number').map(([n, cells]) => [n, new Map(cells)]))}
            const m = own.rule.machine, given = d.given.every(g => evalC(g, env, st, m))
            if (given) {
              if (!evalC(d.then, env, st, m)) { cell.killed = true; cell.witness ??= {params, request} }
            }
          }
          row.laws[own.name] = cell
        }
        row.status = Object.values(row.laws).some(l => l.killed) ? 'killed' : Object.values(row.laws).every(l => l.proven && l.checked) ? 'survived' : 'unknown'
      }
      // Concrete refutation contradicting an accepted proof is an instrument/kernel issue, never a good score.
      if (Object.values(row.laws).some(l => l.killed && l.proven && l.checked)) throw new Error('concrete violation contradicts checked proof')
      row.likely_equivalent = row.status === 'survived' && row.observations.runs >= opts.trials && row.observations.steps > 0 && !row.observations.differs
    } catch (error) { row.status = 'unknown'; row.likely_equivalent = false; row.error = String(error); for (const cell of Object.values(row.laws)) cell.killed = false }
    row.ms = performance.now() - t0
    for (const [name, cell] of Object.entries(row.laws)) (matrix[name] ??= {})[id] = cell
    rows.push(row)
  }
  return {supported: true, scope: c.kind === 'rule' ? 'compiled machine; fixed laws' : 'public Fun specification callbacks re-run over changed return expression', seed: opts.seed, options: opts, candidates: candidates.length, truncated: candidates.length > opts.cap, rows, matrix, summary: summarize(rows), ms: performance.now() - start}
}
