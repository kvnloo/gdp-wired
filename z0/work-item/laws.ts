import {nat,upTo,rule,when,yes,proveSteps} from '../../core/dsl.ts'
import {watch} from '../../core/watch.ts'
import {machineCase} from '../../examples/harness.ts'
import type {Entry} from '../entry.ts'
import {lifecycle,delta,available,board,sameItem,ownerEvent,coder,fields,inputs,initial,happy,type Bug} from './port.ts'
export const names=['merged_needs_owner_acceptance','verify_gate_not_author','integrate_gate_not_author','accept_gate_owner_not_author','draft_needs_bound_receipt','integration_needs_bound_receipt','deployed_serves_integrated_head','drift_undeploys','interrupted_can_resume','interrupted_can_abandon','interrupted_exits_keep_head','implementer_is_coder','owner_off_holds','queue_never_blocks','board_frame']
export const mutations:Bug[]=['merge-before-accept','self-verify','self-integrate','any-accept','unbound-receipt','unbound-receipt','stale-deploy','ignore-drift','no-resume','no-abandon','lose-resume-head','free-coder','owner-fires','hold-all','board-broadcast']
const phaseFor:Record<number,number>={1:3,2:4,3:6,4:3,5:4,7:6,8:10,9:10,10:10}
export function arbitrary(phase:number|undefined,bug?:Bug,av=false){
 const p:any={};for(const f of fields)p['p_'+f]=f==='phase'?upTo(11):f==='ar'||f==='apr'?upTo(7):nat
 return rule('observed item').params(p).inputs({...inputs,...(av?{av:upTo(2)}:{})}).state(Object.fromEntries(fields.map(f=>[f,f==='phase'&&phase!==undefined?phase:(p:any)=>p['p_'+f]]))).step((e:any)=>av?available(e,bug):delta(e,bug))
}
export function claim(i:number,r:any){
 const s=(name:string,fn:any,given?:any)=>r.stepLaw(name,fn,given), name=names[i]
 switch(i){
 case 0:return {laws:[r.law(name,(e:any)=>e.phase.eq(8).implies(e.apr.eq(0).and(e.ap.eq(e.au).not())))]}
 case 1:return {steps:[s(name,(b:any,a:any)=>a.phase.eq(4).implies(b.ev.eq(4).and(b.role.eq(7),b.actor.eq(b.au).not())),(b:any)=>b.phase.eq(3))]}
 case 2:return {steps:[s(name,(b:any,a:any)=>a.phase.eq(5).implies(b.ev.eq(5).and(b.role.eq(7).or(b.role.eq(1)),b.actor.eq(b.au).not())),(b:any)=>b.phase.eq(4))]}
 case 3:return {steps:[s(name,(b:any,a:any)=>a.phase.eq(7).implies(b.ev.eq(8).and(b.role.eq(0),b.actor.eq(b.au).not())),(b:any)=>b.phase.eq(6))]}
 case 4:return {steps:[s(name,(b:any,a:any)=>a.phase.eq(4).implies(b.ev.eq(4).and(b.passed,b.rsha.eq(b.hd))),(b:any)=>b.phase.eq(3))]}
 case 5:return {steps:[s(name,(b:any,a:any)=>a.phase.eq(5).implies(b.ev.eq(5).and(b.passed,b.rsha.eq(b.sha))),(b:any)=>b.phase.eq(4))]}
 case 6:return {laws:[r.law(name,(e:any)=>e.phase.eq(6).implies(e.dp.eq(e.ig)))]}
 case 7:return {steps:[s(name,(b:any,a:any)=>a.phase.eq(5).and(a.au.eq(b.au),a.ar.eq(b.ar),a.hd.eq(b.hd),a.ig.eq(b.ig)),(b:any)=>b.phase.eq(6).and(b.ev.eq(7),b.sha.eq(b.ig).not()))]}
 case 8:return {steps:[s(name,(b:any,a:any)=>a.phase.eq(2).and(a.au.eq(b.actor),a.ar.eq(2),a.hd.eq(b.hd)),(b:any)=>b.phase.eq(10).and(b.ev.eq(13),b.role.eq(2)))]}
 case 9:return {steps:[s(name,(_:any,a:any)=>a.phase.eq(11),(b:any)=>b.phase.eq(10).and(b.ev.eq(14),b.role.eq(0)))]}
 case 10:return {steps:[s(name,(b:any,a:any)=>a.phase.eq(11).or(a.phase.eq(10).or(a.phase.eq(2)).and(a.hd.eq(b.hd))),(b:any)=>b.phase.eq(10))]}
 case 11:return {laws:[r.law(name,(e:any)=>e.phase.eq(2).implies(coder(e.ar)))]}
 case 12:return {steps:[s(name,(b:any,a:any)=>sameItem(b,a),(b:any)=>b.av.eq(2).and(ownerEvent(b)))]}
 case 13:return {steps:[s(name,(b:any,a:any)=>sameItem(a,delta(b)),(b:any)=>b.j.eq(b.i).and(ownerEvent(b).not()))]}
 default:return {steps:[s(name,(b:any,a:any)=>sameItem(b,a),(b:any)=>b.i.eq(b.j).not())]}
 }
}
export function helpers(i:number,r:any){
 if(i===0)return [r.law('accepted carries independent owner',(e:any)=>e.phase.eq(7).implies(e.apr.eq(0).and(e.ap.eq(e.au).not())))]
 if(i===11)return [r.law('every live author is coder',(e:any)=>e.phase.eq(0).or(e.phase.eq(11)).or(coder(e.ar)))]
 return []
}
export function make(i:number,bug?:Bug){
 const r=i===0||i===6||i===11?lifecycle(bug):i>=13?board(bug):arbitrary(phaseFor[i],bug,i===12)
 const q=claim(i,r);return {rule:r,laws:[...helpers(i,r),...(q.laws??[])],steps:q.steps??[]}
}
export function violation(c:any,params:any,trace:any[]){
 const r=c.rule,run=r.interpreter(),p=r.encodeParams(params),ws=[...c.laws,...c.steps].map(w=>watch(r.machine,run,w,p,4));let st=run.init(p)
 for(const w of ws)if(!w.start(st))return {breaks:true,params,trace:[]}
 for(let j=0;j<trace.length;j++){const input=r.encodeInput(trace[j]),b=st;st=run.step(p,st,input);if(ws.some(w=>!w.step(b,input,st)))return {breaks:true,params,trace:trace.slice(0,j+1)}}
 return {breaks:false}
}
export function witness(i:number,bug=mutations[i]){
 const c=make(i,bug),p:any={n:2,j:0};for(const f of fields)p['p_'+f]=f==='phase'?2:f==='ar'?2:f==='hd'?1:0
 if(i===0||i===6||i===11){
  const tapes=[happy,[...happy.slice(0,7),{ev:9,actor:3,role:7,sha:0,rsha:0,passed:false}],happy.map((e,j)=>j===6?{...e,sha:3}:e),[{ev:0,actor:1,role:4,sha:0,rsha:0,passed:false},{ev:1,actor:1,role:4,sha:0,rsha:0,passed:false}]]
  for(const t of tapes){const w=violation(c,{},t);if(w.breaks)return w}
 }
 for(const ph of [phaseFor[i]??2,6,10,4,3,0])for(const ev of [4,5,8,7,13,14,0,1,9,2])for(const role of [0,1,2,4,7])for(const actor of [0,1])for(const sha of [0,1,2]){
  const t=violation(c,{...p,p_phase:ph},[{ev,role,actor,sha,rsha:0,passed:true,av:2,i:i===14?1:0}]);if(t.breaks)return t
 }
 return {breaks:false}
}
const lines=[108,130,144,158,178,192,201,211,228,234,251,259,270,278,287]
export const bendLaws:Entry[]=names.map((name,i)=>({n:i+1,law_id:name,src:`bend/work_item_fsm/LAWS.bend:${lines[i]}`,bend:name,says:name,fns:'fsm.bend step/run/astep/board_step; work_item.py step/run/astep',kind:[0,6,11].includes(i)?'law':'step law',encoding:i>=13?'abstracted':'interned',how:[0,11].includes(i)?'added invariant':'automatic',case:()=>{const good=make(i),bad=make(i,mutations[i]);return machineCase(name,name,good.rule,good.laws,[{name:mutations[i]!,why:'source mutation or per-law negative control',...bad}],{steps:good.steps,depth:12,bound:3})},witness:()=>{const w=witness(i);return {breaks:w.breaks,detail:JSON.stringify(w)}}}))
export const extras:Entry[]=[
 ['resume_any_coder','lose-resume-head',(r:any)=>r.stepLaw('resume_any_coder',(b:any,a:any)=>a.phase.eq(2).and(a.hd.eq(b.hd),a.au.eq(b.actor),a.ar.eq(b.role)),(b:any)=>b.phase.eq(10).and(b.ev.eq(13),coder(b.role)))],
 ['abandon_any_steward','no-abandon',(r:any)=>r.stepLaw('abandon_any_steward',(_:any,a:any)=>a.phase.eq(11),(b:any)=>b.phase.eq(10).and(b.ev.eq(14),b.role.eq(0).or(b.role.eq(1))))],
 ['never_merged_twice','reopen-merged',(r:any)=>r.law('never_merged_twice',(e:any)=>e.merges.atMost(1))],
 ['acceptance_precedes_merge_any_distance','merge-before-accept',(r:any)=>r.law('acceptance_precedes_merge_any_distance',(e:any)=>e.merges.atMost(e.accepts))],
].map(([id,bug,law]:any,j)=>({n:0,law_id:id,src:'bend/work_item_fsm/fsm.bend:291-316',bend:id,says:id,fns:'step/run',kind:j<2?'step law':'law',encoding:'interned',case:()=>{const r=j<2?arbitrary(10):lifecycle(),b=j<2?arbitrary(10,bug):lifecycle(bug);return machineCase(id,id,r,j<2?[]:[law(r)],[{name:bug,why:'extra negative control',rule:b,laws:j<2?[]:[law(b)],steps:j<2?[law(b)]:[]}],{steps:j<2?[law(r)]:[],bound:3,depth:16})}}))
