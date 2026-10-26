// R1 arm G: authored against the port before reading/transcribing Bend laws.
// Absorption for every event is stronger than excluding specific restart states.
// By induction, any finite event suffix after abandonment remains Abandoned.
import {mkdirSync, writeFileSync} from 'node:fs'
import {proveSteps} from '../../core/dsl.ts'
import {watch} from '../../core/watch.ts'
import {worker, events} from './port.ts'

export function abandonmentLaw(c: ReturnType<typeof worker>) {
  return c.stepLaw('owner_abandoned_never_resumes_or_restarts',
    (_before, after) => after.in('Abandoned'),
    before => before.in('Abandoned'))
}
const c = worker(), law = abandonmentLaw(c), r = c.rule
const reachable = proveSteps(r, [], [law], {search: false})
const anyState = proveSteps(r, [], [law], {from: 'any', search: false})
const broken = worker('revive_abandoned'), brokenLaw = abandonmentLaw(broken)
const rejected = proveSteps(broken.rule, [], [brokenLaw], {from: 'any', search: false})
const params = r.encodeParams({lim: 1, heavy: false, exc: 0})
function witness(chart: ReturnType<typeof worker>) {
  const rr = chart.rule, runtime = rr.interpreter()
  const input = (event: string) => rr.encodeInput({event, host: 1, t: 0, successor: 2, log: true})
  const initial = runtime.init(params)
  const abandoned = runtime.step(params, initial, input('Abandon'))
  const resumed = runtime.step(params, abandoned, input('Resume'))
  return {initial: rr.decode(initial), abandoned: rr.decode(abandoned), next: rr.decode(resumed),
    lawHolds: watch(rr.machine, runtime, abandonmentLaw(chart), params, 3).step(abandoned, input('Resume'), resumed)}
}
const goodWitness = witness(c), badWitness = witness(broken)
const runtime = r.interpreter(), abandoned = runtime.step(params, runtime.init(params), r.encodeInput({event:'Abandon',host:1,t:0,successor:2,log:true}))
const allEvents = events.map(event => {
  const input = r.encodeInput({event,host:1,t:9,successor:2,log:true})
  const next = runtime.step(params, abandoned, input)
  return {event, state: r.decode(next), holds: watch(r.machine,runtime,law,params,3).step(abandoned,input,next)}
})
const crossCheck = r.crossCheck([], [law], {trials:30,depth:20,bound:3})
const brokenCrossCheck = broken.rule.crossCheck([], [brokenLaw], {trials:30,depth:20,bound:3})
const ok = reachable.proven && reachable.checked && anyState.proven && anyState.checked && !anyState.assumes
  && !rejected.proven && goodWitness.lawHolds && !badWitness.lawHolds
  && allEvents.every(x => x.holds) && !crossCheck.failure && !brokenCrossCheck.failure
const result = {rule:'R1',arm:'G',reachable,anyState,rejected,goodWitness,badWitness,allEvents,crossCheck,brokenCrossCheck,ok}
mkdirSync('out',{recursive:true})
writeFileSync('out/r1.json',JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify(result,null,2))
if(!ok) process.exit(1)
