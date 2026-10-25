// Source d75c94439b75: bend/intent_gate/intent.bend:8-93.
// JS: omp-extensions/z0-relay-guard/checker.js:202-225,292-375;
// intent.js:179-205,242-287; verifiers.js:56-104. This is a gate port, NOT an extraction.
import {bool, nat, oneOf, fun, rule, when, yes, no, everyKey, count, lit} from '../../core/dsl.ts'
export type Env = any
export const status = oneOf('open','dropped','delegated','verified')
export const inputs: Record<string, any> = {
 authority: {mutating:bool,approved:bool}, turn:{ending:bool,status,reason:bool,live:bool,verified:bool},
 proof:{updated:bool,marked:bool,passed:bool,tool:bool},
 window:{asked:nat,changed:nat,start:nat,finish:nat,recorded:nat},
 delegate:{delegated:bool,received:bool,result:nat,start:nat},
 claim:{proof:bool,fresh:bool,delegate:bool,identity:bool},
 identity:{task:nat,verifier:nat,result:nat,acceptance:nat,used:nat},
 resolved:{status,reason:bool,visible:bool,returned:bool,parent_verified:bool},
 overdue:{approved:bool,unresolved:bool,age:nat},
}
export function expression(g:string,e:Env,bug='') {
 const omit=(id:string,c:any)=>bug===id?yes:c
 let o:any
 switch(g){
 case 'authority': o=e.mutating.not().or(e.approved); if(bug==='m0')o=yes;if(bug==='m1')o=e.mutating.not();if(bug==='m2')o=e.approved;break
 case 'turn':o=e.ending.not().or(e.status.match({open:()=>bug==='m3'?yes:no,dropped:()=>omit('m4',e.reason),delegated:()=>omit('m5',e.live),verified:()=>omit('m6',e.verified)}));break
 case 'proof':o=omit('m7',e.updated).and(omit('omit_mark',e.marked),omit('m8',e.passed),omit('m9',e.tool));break
 case 'window':o=(bug==='m11'?e.start.atLeast(e.asked):e.start.gt(e.asked)).and(omit('m10',e.changed.atMost(e.start)),omit('omit_finish',e.start.atMost(e.finish)),omit('omit_recorded',e.finish.atMost(e.recorded)));break
 case 'delegate':o=e.delegated.not().or(omit('m12',e.received).and(omit('m13',e.result.atMost(e.start))));break
 case 'claim':o=omit('omit_proof',e.proof).and(omit('m14',e.fresh),omit('omit_delegate',e.delegate),omit('omit_identity',e.identity));break
 case 'identity':o=omit('m15',e.task.eq(e.verifier)).and(omit('m16',e.task.eq(e.result)),omit('m17',e.acceptance.eq(e.used)));break
 case 'resolved':o=e.status.match({open:()=>no,dropped:()=>e.reason.and(omit('m20',e.visible)),delegated:()=>omit('m22',e.returned).and(omit('m21',e.parent_verified)),verified:()=>e.parent_verified});break
 case 'overdue':o=omit('m25',e.approved).and(omit('m24',e.unresolved),bug==='m23'?e.age.atLeast(86400):e.age.gt(86400));break
 default:throw Error(g)
 }
 return bug==='negate'?o.not():o
}
export const gate=(g:string,bug='')=>specialGate(g,{},bug)
// Substitute the literal arguments of a Bend law, leaving its forall arguments free.
// This avoids mistaking sparse random inputs satisfying a constant for coverage.
export const specialGate=(g:string,fixed:Record<string,unknown>,bug='')=> {
 const kinds=inputs[g], constants=Object.fromEntries(Object.entries(fixed).map(([k,value])=> {
  const encoded=kinds[k].encode(k,value)
  return [k,kinds[k].build(k,(part:string)=>lit(encoded[part]))]
 }))
 return fun(`intent.${g}${bug}`).inputs(Object.fromEntries(Object.entries(kinds).filter(([k])=>!(k in fixed))))
  .returns((e:Env)=>({ok:expression(g,{...e,...constants},bug)}))
}
// intent.bend:64-77: lists mapped to characteristic sets (duplicates/order irrelevant).
// Universally quantify membership, not a bounded list or an unverified Boolean summary.
export const relay=(bug='')=>rule(`intent.relay${bug}`).inputs({x:nat}).carries('Forwarded','Carried')
 .flags((e:Env)=>({allowed:bug==='negate'?e.Forwarded.subsetOf(e.Carried).not():bug==='m18'?yes:bug==='m19'?e.Forwarded.has(e.x).implies(e.Carried.has(e.x)):e.Forwarded.subsetOf(e.Carried)}))
 .state({ok:0}).step((e:Env)=>({ok:when(e.allowed,1,0)}))
export const setShape=(m:any,values:number[])=>everyKey(k=>m.at(k).eq(when(values.reduce((c,v)=>c.or(k.eq(v)),no),1,0)))
// Event session, unbounded log + ghost last occurrence indices. Events for a single
// task/execution window; start snapshots prerequisites, later asks/changes invalidate.
// Timestamp ties remain a separate Bool gate: sequence positions are strictly ordered.
// JS causal execution provenance: checker.js:214-222. Source never equates wall time and order.
export const session=(bug='')=>rule('intent.event-log')
 .inputs({event:oneOf('ask','change','delegate','result','start','finish','record','claim','noise'),ok:bool})
 .log('event','ok')
 .sums({events:()=>count(yes)})
 .state({ask:0,change:0,result:0,start:0,finish:0,record:0,valid:0,seenAsk:0,seenResult:0,delegated:0,snapAsk:0,snapChange:0,snapResult:0,accepted:0})
 .flags((e:Env)=>({fresh:e.seenAsk.eq(1).and(e.ask.lt(e.events.plus(1)),e.change.atMost(e.events.plus(1)),e.delegated.eq(0).or(e.seenResult.eq(1).and(e.result.lt(e.events.plus(1)))))}))
 .step((e:Env)=>{
 const at=e.events.plus(1), is=(x:string)=>e.event.is(x), reset=is('ask').or(bug==='ignore_change'?no:is('change'),is('delegate'))
 return {ask:when(is('ask'),at,e.ask),change:when(is('change'),at,e.change),result:when(is('result'),at,e.result),
 start:when(is('start'),at,e.start),finish:when(is('finish'),at,e.finish),record:when(is('record'),at,e.record),
 seenAsk:when(is('ask'),1,e.seenAsk),seenResult:when(is('delegate'),0,when(is('result'),1,e.seenResult)),delegated:when(is('delegate'),1,e.delegated),
 snapAsk:when(is('start'),e.ask,e.snapAsk),snapChange:when(is('start'),e.change,e.snapChange),snapResult:when(is('start'),e.result,e.snapResult),
 valid:when(reset,0,when(is('start'),when(bug==='skip_prereqs'?yes:e.fresh,1,0),e.valid)),
 accepted:when(is('claim'),when(e.valid.eq(1).and(e.start.gt(0),bug==='skip_finish'?yes:e.finish.gt(e.start),bug==='skip_record'?yes:e.record.gt(e.finish),e.ok),1,0),0)}
 })
export const mutants=[
 ['m0','authority'],['m1','authority'],['m2','authority'],['m3','turn'],['m4','turn'],['m5','turn'],['m6','turn'],['m7','proof'],['m8','proof'],['m9','proof'],['m10','window'],['m11','window'],['m12','delegate'],['m13','delegate'],['m14','claim'],['m15','identity'],['m16','identity'],['m17','identity'],['m18','relay'],['m19','relay'],['m20','resolved'],['m21','resolved'],['m22','resolved'],['m23','overdue'],['m24','overdue'],['m25','overdue']
] as const
