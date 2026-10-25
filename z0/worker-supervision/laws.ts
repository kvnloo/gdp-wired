import {rule,bool,nat,oneOf,yes,no} from '../../core/dsl.ts'
import {machineCase,decisionCase} from '../../examples/harness.ts'
import type {Entry} from '../entry.ts'
import {worker,lease,device,needsKevin,leaseHolds,type Bug} from './port.ts'
const root='bend/worker_supervision_fsm/LAWS.bend'
export const specs = [
 ['lease_no_steal',77,'lease_steal'],['lease_release_by_holder',97,'lease_release'],['lease_free_acquires',103,'no_acquire'],['write_needs_lease',107,'write_any'],
 ['interrupted_can_resume',121,'drop_adoption'],['interrupted_can_abandon',129,'no_abandon'],['interrupted_overdue',135,'no_overdue'],['overdue_needs_kevin',144,'no_queue'],
 ['interrupted_exits',165,'silent_complete'],['overdue_exits',185,'restart_clock'],['running_stalls',193,'no_stall'],['stalled_interrupts',203,'no_interrupt'],
 ['end_needs_reaped',252,'abandon_bg'],['running_is_placed',261,'placement'],['stalled_is_placed',272,'placement'],
 ['install_needs_lock',299,'install_unlocked'],['install_lock_no_steal',306,'phone_steal'],['input_needs_foreground',330,'wrong_foreground'],['input_needs_fresh_look',337,'stale_look']
] as const
export function modelCase(id:string,bug?:Bug):any {
 if(id==='write_needs_lease'){
  const r=rule('holds').inputs({held:bool,owner:nat,a:nat})
  return {kind:'decisions',rule:r,decisions:[r.decide(id,e=>leaseHolds(e.held,e.owner,e.a,bug),e=>e.held.and(e.owner.eq(e.a)))]}
 }
 if(id==='overdue_needs_kevin'){
  const r=rule('needs Kevin').inputs({phase:oneOf('Dispatched','Running','Stalled','Interrupted','Overdue','Completed','Resumed','Abandoned','Integrated')})
  return {kind:'decisions',rule:r,decisions:[r.decide(id,e=>e.phase.is('Overdue'),e=>needsKevin(e.phase,bug))]}
 }
 if(id.startsWith('lease_')){
  let r=lease(bug)
  if(bug==='no_acquire') r=r.step(({held,owner})=>({held,owner}))
  const s=id==='lease_no_steal'?r.stepLaw(id,(b,a)=>a.held.and(a.owner.eq(b.owner).not()).implies(b.op.is('Reclaim').and(b.dead)),b=>b.held):
   id==='lease_release_by_holder'?r.stepLaw(id,(b,a)=>a.held.not().implies(b.op.is('Release').and(b.a.eq(b.owner))),b=>b.held):
   r.stepLaw(id,(b,a)=>a.held.and(a.owner.eq(b.a)),b=>b.held.not().and(b.op.is('Acquire')))
  return {kind:'rule',rule:r,laws:[],steps:[s]}
 }
 if(id.startsWith('install_')||id.startsWith('input_')){
  const r=device(bug)
  const s=id==='install_needs_lock'?r.stepLaw(id,(b,a)=>a.installed.implies(b.op.is('Install').and(b.held,b.owner.eq(b.a)))):
   id==='install_lock_no_steal'?r.stepLaw(id,(b,a)=>a.held.and(a.owner.eq(b.owner),a.seen.implies(b.seen).and(b.seen.implies(a.seen)),a.fg.eq(b.fg)),b=>b.held.and(b.op.is('Lock'))):
   id==='input_needs_foreground'?r.stepLaw(id,(b,a)=>a.typed.implies(b.op.is('Input').and(b.seen,b.fg.eq(b.app)))):
   r.stepsLaw(id,2,(_,a)=>a.typed.not(),b=>b.op.is('Input'))
  return {kind:'rule',rule:r,laws:[],steps:[s]}
 }
 const c=worker(bug),r=c.rule
 const placed=(e:any)=>e.h.eq(0).not().or(e.heavy.not(),e.exc.eq(0).not())
 if(id==='running_is_placed'||id==='stalled_is_placed'){
  const running=c.law('running_is_placed',e=>e.in('Running').implies(placed(e)))
  const stalled=c.law('stalled_is_placed',e=>e.in('Stalled').implies(placed(e)))
  return {kind:'rule',rule:r,laws:[running,stalled],steps:[]}
 }
 let s:any
 switch(id){
 case 'interrupted_can_resume':s=c.stepLaw(id,(b,a)=>a.in('Resumed').and(a.by.eq(b.successor),a.bg.eq(b.bg)),b=>b.in('Interrupted').and(b.event.is('Resume'),b.log));break
 case 'interrupted_can_abandon':s=c.stepLaw(id,(_,a)=>a.in('Abandoned'),b=>b.in('Interrupted').and(b.bg.eq(0),b.event.is('Abandon')));break
 case 'interrupted_overdue':s=c.stepLaw(id,(b,a)=>a.in('Overdue').and(a.at.eq(b.at),a.bg.eq(b.bg)),b=>b.in('Interrupted').and(b.event.is('Tick'),b.t.gt(b.at.plus(b.lim))));break
 case 'interrupted_exits':s=c.stepLaw(id,(_,a)=>a.in('Interrupted').or(a.in('Overdue'),a.in('Resumed'),a.in('Abandoned')),b=>b.in('Interrupted'));break
 case 'overdue_exits':s=c.stepLaw(id,(_,a)=>a.in('Overdue').or(a.in('Resumed'),a.in('Abandoned')),b=>b.in('Overdue'));break
 case 'running_stalls':s=c.stepLaw(id,(b,a)=>a.in('Stalled').and(a.h.eq(b.h),a.hb.eq(b.hb),a.bg.eq(b.bg)),b=>b.in('Running').and(b.event.is('Tick'),b.t.gt(b.hb.plus(b.lim))));break
 case 'stalled_interrupts':s=c.stepLaw(id,(b,a)=>a.in('Interrupted').and(a.at.eq(b.t),a.bg.eq(b.bg)),b=>b.in('Stalled').and(b.event.is('Tick'),b.t.gt(b.hb.plus(b.lim).plus(b.lim))));break
 case 'end_needs_reaped':s=c.stepLaw(id,(b,a)=>a.in('Abandoned').or(a.in('Integrated')).implies(b.bg.eq(0)),b=>b.in('Abandoned').or(b.in('Integrated')).not().and(b.in('Dispatched').not()));break
 case 'abandoned_never_resumes':s=c.stepLaw(id,(_,a)=>a.in('Abandoned'),b=>b.in('Abandoned'));break
 case 'resume_requires_log':s=c.stepLaw(id,(_,a)=>a.in('Resumed').not(),b=>b.in('Interrupted').or(b.in('Overdue')).and(b.event.is('Resume'),b.log.not()));break
 case 'overdue_resume_adopts':s=c.stepLaw(id,(b,a)=>a.in('Resumed').and(a.bg.eq(b.bg),a.by.eq(b.successor)),b=>b.in('Overdue').and(b.event.is('Resume'),b.log));break
 default:throw Error(id)
 }
 // Dispatched has no bg in the Bend variant. The rule's extraneous context must not weaken end_needs_reaped:
 // dispatched-to-Abandoned is separately the exact structural fact bg_of(Dispatched)=0.
 if(id==='end_needs_reaped') s=c.stepLaw(id,(b,a)=>a.in('Abandoned').or(a.in('Integrated')).implies(b.in('Dispatched').or(b.bg.eq(0))),b=>b.in('Abandoned').or(b.in('Integrated')).not())
 return {kind:'rule',rule:r,laws:[],steps:[s]}
}
function entry(n:number,id:string,line:number,bug:string):Entry{
 return {n,law_id:id,src:`${root}:${line}`,bend:id,says:id,fns:'step/run/lstep/holds/peff/pstep',kind:id.includes('is_placed')?'law':id==='overdue_needs_kevin'||id==='write_needs_lease'?'decide':id==='input_needs_fresh_look'?'k-step law':'step law',encoding:'exact',case:()=>{
  const good=modelCase(id),bad=modelCase(id,bug)
  return good.kind==='decisions'?decisionCase(id,id,good.decisions,[{name:bug,why:bug,decision:bad.decisions[0]}]):machineCase(id,id,good.rule,good.laws,[{name:bug,why:bug,rule:bad.rule,laws:bad.laws,steps:bad.steps}],{steps:good.steps,depth:18,bound:4})
 }}
}
export const bendLaws:Entry[]=specs.map(([id,line,bug],i)=>entry(i+1,id,line,bug))
export const extras:Entry[]=[entry(0,'abandoned_never_resumes',165,'revive_abandoned'),entry(0,'resume_requires_log',121,'resume_no_log'),entry(0,'overdue_resume_adopts',121,'drop_overdue_adoption')]
