// R2 arm G: author against the supplied port before transcribing to Bend.
import {writeFileSync} from 'node:fs'
import {proveSteps} from '../../core/dsl.ts'
import {watch} from '../../core/watch.ts'
import {EV, PH, lifecycle, type Env} from './port.ts'

export const r2 = (r: ReturnType<typeof lifecycle>) => r.stepLaw(
  'interrupted_any_coder_can_resume',
  (before: Env, after: Env) => after.phase.eq(PH.Implementing)
    .and(after.au.eq(before.actor), after.ar.eq(before.role), after.hd.eq(before.hd)),
  (before: Env) => before.phase.eq(PH.Interrupted).and(before.ev.eq(EV.Resume),
    before.role.eq(1).or(before.role.eq(2))),
)
const r = lifecycle(), law = r2(r)
const t0 = performance.now()
const first = proveSteps(r, [], [law], {search: false})
const any = proveSteps(r, [], [law], {from: 'any', search: false})
const bad = lifecycle('no-opus-resume')
const broken = proveSteps(bad, [], [r2(bad)], {from: 'any', search: false})
const builders = r.crossCheck([], [law], {trials: 40, depth: 30, bound: 16})
const badBuilders = bad.crossCheck([], [r2(bad)], {trials: 40, depth: 30, bound: 16})

// A reachable witness, same old/new actor identities deliberately not required.
const trace = [
  {ev: EV.Claim, actor: 7, role: 2}, {ev: EV.Start, actor: 7, role: 2},
  {ev: EV.Push, actor: 7, role: 2, sha: 31}, {ev: EV.Interrupt, actor: 7, role: 2},
  {ev: EV.Resume, actor: 19, role: 1},
].map(x => ({sha: 0, rsha: 0, passed: false, ...x}))
function replay(rule: ReturnType<typeof lifecycle>) {
  const run = rule.interpreter(), compiled = rule.compiled()
  const watcher = watch(rule.machine, run, r2(rule), {}, 0)
  let state = run.init({}), fast = compiled.init({})
  const rows = []
  for (const raw of trace) {
    const input = rule.encodeInput(raw), before = state
    state = run.step({}, state, input); fast = compiled.step({}, fast, input)
    if (JSON.stringify(state.scalars) !== JSON.stringify(fast.scalars)) throw new Error('runtime mismatch')
    rows.push({input, before: before.scalars, after: state.scalars, lawHolds: watcher.step(before, input, state)})
  }
  return rows
}
const goodTrace = replay(r), brokenTrace = replay(bad)
// Explicit non-vacuity / role-domain checks, beyond random reachable traces.
const cases = []
const run = r.interpreter(), compiled = r.compiled()
for (let role = 0; role < 8; role++) for (const oldRole of [0, 1, 2, 7])
for (const actor of [0, 7, 19]) for (const head of [0, 31]) {
  const before = {...run.init({}), scalars: {...run.init({}).scalars,
    phase: PH.Interrupted, au: 7, ar: oldRole, hd: head}}
  const input = r.encodeInput({ev: EV.Resume, actor, role, sha: 0, rsha: 0, passed: false})
  const after = run.step({}, before, input)
  const fast = compiled.step({}, {...before, scalars: {...before.scalars}}, input)
  const coder = role === 1 || role === 2
  const ok = after.scalars.phase === (coder ? PH.Implementing : PH.Interrupted)
    && after.scalars.au === (coder ? actor : 7) && after.scalars.ar === (coder ? role : oldRole)
    && after.scalars.hd === head && JSON.stringify(after.scalars) === JSON.stringify(fast.scalars)
  if (!ok) throw new Error('concrete role-domain mismatch')
  cases.push({role, oldRole, actor, head, ok})
}
const result = {first, any, broken, builders, badBuilders, goodTrace, brokenTrace,
  concreteCases: cases.length, concreteCasesAllPass: cases.every(x => x.ok),
  ms: performance.now() - t0,
  ok: first.proven && first.checked && any.proven && any.checked && !any.assumes
    && !broken.proven && !builders.failure && !badBuilders.failure
    && goodTrace.every(x => x.lawHolds) && brokenTrace.at(-1)!.lawHolds === false}
console.log(JSON.stringify(result, null, 2))
const i = process.argv.indexOf('--json')
if (i >= 0) writeFileSync(process.argv[i + 1]!, JSON.stringify(result, null, 2) + '\n')
if (!result.ok) process.exit(1)
