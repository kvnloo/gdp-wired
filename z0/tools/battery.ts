import {mkdirSync, writeFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {proveDecision, proveLoop, proveSteps} from '../../core/dsl.ts'
import {checkCase, type Case} from '../../examples/harness.ts'
import type {Entry} from '../entry.ts'
import {enableDecisionCapture} from './decisions.ts'
import {mutateCase, summarize, type Options} from './mutate.ts'
import {funOf} from '../../core/dsl.ts'

export const jsonReplacer = (_key: string, value: unknown): unknown => value instanceof Map ? {__map__: [...value.entries()]} : value
export function writeJSON(path: string, value: unknown): void {
  mkdirSync(dirname(path), {recursive: true})
  writeFileSync(path, JSON.stringify(value, jsonReplacer, 1) + '\n')
}
const prove = (c: Case) => c.kind === 'rule' ? proveSteps(c.rule, c.laws, c.steps ?? []) : c.kind === 'loop' ? proveLoop(c.loop, c.laws) : undefined
export function checkEntry(e: Entry) {
  const c = e.case(), start = performance.now(), times: number[] = []
  const verdicts = []
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now(), vs = c.kind === 'decisions' ? c.decisions.map(d => proveDecision(d)) : [prove(c)!]
    times.push(performance.now() - t0)
    if (i === 0) verdicts.push(...vs)
  }
  const findings = checkCase(c), goodKernel = findings.filter(f => f.check === 'kernel')
  const runs = findings.filter(f => f.check === 'runs'), builders = findings.filter(f => f.check === 'builders')
  const brokenRuns = findings.filter(f => f.check === 'counterexample')
  const witness = brokenRuns.some(f => !f.ok) && e.witness ? e.witness() : undefined
  const brokenRefused = c.broken.length > 0 && goodKernel.length > (c.kind === 'decisions' ? c.decisions.length : 1) && goodKernel.every(f => f.ok)
  const brokenRun = brokenRuns.length === c.broken.length && brokenRuns.every(f => f.ok) || c.broken.length === 1 && !!witness?.breaks
  const from_any = c.kind === 'rule' ? proveSteps(c.rule, c.laws, c.steps ?? [], {from: 'any'}) : null
  const proven = verdicts.length > 0 && verdicts.every(v => v.proven), checked = verdicts.length > 0 && verdicts.every(v => v.checked)
  times.sort((a, b) => a - b)
  return {c, row: {n: e.n, law_id: e.law_id, law: e.bend, src: e.src, kind: e.kind, encoding: e.encoding,
    proven, checked, ms: times[2]!, elapsed_ms: performance.now() - start, verdicts, from_any,
    assumes: verdicts.map(v => v.assumes ?? null), findings, witness, brokenRefused, brokenRun,
    ok: proven && checked && runs.length > 0 && runs.every(f => f.ok) && (c.kind === 'loop' || builders.length > 0 && builders.every(f => f.ok)) && brokenRefused && brokenRun}}
}

function union<T extends {name: string}>(a: T[], b: T[]): T[] {
  const out = [...a]
  for (const x of b) {
    const old = out.find(y => y.name === x.name)
    if (!old) out.push(x)
    else if (JSON.stringify(old) !== JSON.stringify(x)) throw new Error(`law name collision: ${x.name}`)
  }
  return out
}
function keyOf(c: Case): string {
  return JSON.stringify(c.kind === 'rule' ? ['rule', c.rule.machine] : c.kind === 'decisions' ? ['decisions', c.decisions.map(d => funOf(d)?.rule.machine ?? d.goal)] : ['loop', c.name])
}
function merge(a: Case, b: Case): Case {
  if (a.kind === 'rule' && b.kind === 'rule') return {...a, laws: union(a.laws, b.laws), steps: union(a.steps ?? [], b.steps ?? [])}
  if (a.kind === 'decisions' && b.kind === 'decisions') return {...a, decisions: union(a.decisions, b.decisions)}
  return a
}
export async function battery(lawsPath: string, out: string, opts: Partial<Options> = {}) {
  enableDecisionCapture() // before importing factories, including module-level Fun construction
  const module = await import(pathToFileURL(resolve(lawsPath)).href)
  if (!Array.isArray(module.bendLaws) || !Array.isArray(module.extras)) throw new Error('laws module must export bendLaws and extras arrays')
  const entries: Entry[] = [...module.bendLaws, ...module.extras]
  for (const e of entries) if (typeof e.case !== 'function' || typeof e.law_id !== 'string') throw new Error('invalid Entry: case() and law_id required')
  if (new Set(entries.map(e => e.law_id)).size !== entries.length) throw new Error('duplicate Entry law_id')
  const start = performance.now(), rows: unknown[] = [], mutations: unknown[] = [], allMutants: Parameters<typeof summarize>[0] = []
  const groups = new Map<string, {id: string, c: Case, law_ids: string[]}>()
  const result = {schema: 'gdp-wired-battery-v1', family: module.family ?? dirname(lawsPath).split('/').pop(), laws_path: lawsPath,
    complete: false, seed: opts.seed ?? 1, started_at: new Date().toISOString(), options: opts, rows, mutations,
    summary: {entries: entries.length, ok: 0, proven_checked: 0, mutation: summarize(allMutants)}, elapsed_ms: 0}
  const save = () => { result.elapsed_ms = performance.now() - start; result.summary.mutation = summarize(allMutants); writeJSON(out, result) }
  save()
  for (const e of entries) {
    try {
      const {c, row} = checkEntry(e), key = keyOf(c), group = groups.get(key) ?? {id: `G${String(groups.size + 1).padStart(4, '0')}`, c, law_ids: []}
      if (groups.has(key)) group.c = merge(group.c, c)
      group.law_ids.push(e.law_id); groups.set(key, group)
      rows.push({...row, mutation_case: group.id})
      if (row.ok) result.summary.ok++
      if (row.proven && row.checked) result.summary.proven_checked++
      process.stderr.write(`${row.ok ? 'ok' : 'FAIL'} ${e.law_id}\n`)
    } catch (error) { rows.push({law_id: e.law_id, law: e.bend, n: e.n, ok: false, error: String(error)}) }
    save()
  }
  for (const group of groups.values()) {
    try {
      const measurement = mutateCase(group.c, opts)
      mutations.push({id: group.id, name: group.c.name, law_ids: group.law_ids, ...measurement})
      allMutants.push(...measurement.rows)
      process.stderr.write(`${group.id} ${JSON.stringify(measurement.summary)}\n`)
    } catch (error) { mutations.push({id: group.id, law_ids: group.law_ids, supported: false, error: String(error)}) }
    save()
  }
  result.complete = true; save()
  return result
}

if (import.meta.main) {
  const args = process.argv.slice(2), get = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1] }
  const laws = get('--laws'), out = get('--json')
  if (!laws || !out) throw new Error('usage: bun z0/tools/battery.ts --laws laws.ts --json out.json [--mutants 200] [--seed 1] [--trials 200] [--strict]')
  const opts: Partial<Options> = {}
  for (const [flag, key] of [['--mutants', 'cap'], ['--seed', 'seed'], ['--trials', 'trials'], ['--depth', 'depth'], ['--bound', 'bound']] as const) {
    const raw = get(flag)
    if (raw !== undefined) { const n = Number(raw); if (!Number.isSafeInteger(n) || n < 0 || key !== 'cap' && key !== 'seed' && n === 0) throw new Error(`invalid ${flag}`); opts[key] = n }
  }
  const r = await battery(laws, out, opts)
  if (args.includes('--strict') && r.summary.ok !== r.summary.entries) process.exitCode = 1
}
