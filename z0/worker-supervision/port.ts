// Reference checkout sqlite-store-laws @ d2e346146380 (read only).
// Worker: bend/worker_supervision_fsm/fsm.bend:133-235;
// Python: src/z0int/fsm/worker_supervision.py:91-145.
import {bool, nat, oneOf, upTo, rule, when, yes, no} from '../../core/dsl.ts'
import {chart} from '../../core/chart.ts'
export const phases = ['Dispatched','Running','Stalled','Interrupted','Overdue','Completed','Resumed','Abandoned','Integrated'] as const
export const events = ['Start','Beat','Spawn','Reap','Tick','Finish','Interrupt','Resume','Abandon','Integrate'] as const
export type Bug = string | undefined
export function worker(bug?: Bug) {
  const clear = {h:0,hb:0,at:0,by:0}
  let c = chart('worker supervision').events(...events)
    .params({lim:nat, heavy:bool, exc:upTo(2)})
    .inputs({host:upTo(2), t:nat, successor:nat, log:bool})
    .context({h:0,hb:0,at:0,bg:0,by:0})
    .states({Dispatched:{},Running:{},Stalled:{},Interrupted:{},Overdue:{},Completed:{},Resumed:{final:true},Abandoned:{final:true},Integrated:{final:true}}, {field:'phase'})
    .on('Start',{from:'Dispatched',to:'Running',when:({host,heavy,exc})=>bug==='placement'||bug==='exception'?yes:host.eq(0).not().or(heavy.not(),exc.eq(0).not()),set:({host,t})=>({...clear,h:host,hb:t,bg:0})})
    .on('Interrupt',{from:'Dispatched',to:'Interrupted',set:({t})=>({...clear,at:t,bg:0})})
    .on('Abandon',{from:'Dispatched',to:'Abandoned',set:()=>({...clear,bg:0})})
    .on('Beat',{from:['Running','Stalled'],to:'Running',set:({t})=>({hb:t})})
    .on('Spawn',{from:'Running',set:({bg})=>({bg:bg.plus(1)})})
    .on('Reap',{from:['Running','Stalled','Interrupted','Overdue','Completed'],set:({bg})=>({bg:bg.minus(1)})})
    .on('Tick',{from:'Running',to:'Stalled',when:({t,hb,lim})=>bug==='no_stall'?no:t.gt(hb.plus(lim))})
    .on('Tick',{from:'Stalled',to:'Interrupted',when:({t,hb,lim})=>bug==='no_interrupt'?no:t.gt(hb.plus(lim).plus(lim)),set:({t})=>({...clear,at:t})})
    .on('Finish',{from:['Running','Stalled'],to:'Completed',set:()=>clear})
    .on('Interrupt',{from:['Running','Stalled'],to:'Interrupted',set:({t})=>({...clear,at:t})})
    .on('Tick',{from:'Interrupted',to:'Overdue',when:({t,at,lim})=>bug==='no_overdue'?no:t.gt(at.plus(lim))})
    .on('Resume',{from:'Interrupted',to:'Resumed',when:({log})=>bug==='resume_no_log'?yes:bug==='no_resume'?no:log,set:({successor,bg})=>({...clear,by:successor,bg:bug==='drop_adoption'?0:bg})})
    .on('Resume',{from:'Overdue',to:'Resumed',when:({log})=>bug==='resume_no_log'?yes:bug==='no_resume'?no:log,set:({successor,bg})=>({...clear,by:successor,bg:bug==='drop_overdue_adoption'?0:bg})})
    .on('Abandon',{from:'Interrupted',to:'Abandoned',when:({bg})=>bug==='abandon_bg'?yes:bug==='no_abandon'?no:bg.eq(0),set:()=>({...clear,bg:0})})
    .on('Abandon',{from:['Overdue','Completed'],to:'Abandoned',when:({bg})=>bug==='no_abandon'?no:bg.eq(0),set:()=>({...clear,bg:0})})
    .on('Integrate',{from:'Completed',to:'Integrated',when:({bg})=>bug==='integrate_bg'?yes:bg.eq(0),set:()=>({...clear,bg:0})})
  if(bug==='silent_complete') c=c.on('Finish',{from:'Interrupted',to:'Completed',set:()=>clear})
  if(bug==='restart_clock') c=c.on('Tick',{from:'Overdue',to:'Interrupted',set:({t})=>({at:t})})
  if(bug==='revive_abandoned') c=c.on('Resume',{from:'Abandoned',to:'Resumed',set:({successor})=>({by:successor})})
  return c
}
// Lease: fsm.bend:275-305; Python worker_supervision.py:173-184.
export function lease(bug?:Bug){
 return rule('lease').inputs({op:oneOf('Acquire','Release','Reclaim'),a:nat,dead:bool})
 .state({held:bool.from(false),owner:0})
 .step(({held,owner,op,a,dead})=>{
  const acquire=op.is('Acquire').and(bug==='lease_steal'?yes:held.not())
  const release=op.is('Release').and(held,bug==='lease_release'?yes:a.eq(owner))
  const reclaim=op.is('Reclaim').and(held,dead)
  return {held:when(release,no,when(acquire.or(reclaim),yes,held)),owner:when(release,0,when(acquire.or(reclaim),a,owner))}
 })
}
// Device: fsm.bend:339-376; Python worker_supervision.py:195-212.
export function device(bug?:Bug){
 return rule('device').inputs({op:oneOf('Lock','Unlock','Peek','Install','Input'),a:nat,app:nat})
 .state({held:bool.from(false),owner:0,seen:bool.from(false),fg:0,installed:bool.from(false),typed:bool.from(false)})
 .step(({op,a,app,held,owner,seen,fg})=>{
  const lock=op.is('Lock').and(bug==='phone_steal'||bug==='lease_steal'?yes:held.not())
  const unlock=op.is('Unlock').and(held,bug==='lease_release'?yes:a.eq(owner))
  return {held:when(unlock,no,when(lock,yes,held)), owner:when(unlock,0,when(lock,a,owner)),
   seen:when(op.is('Peek'),yes,when(op.is('Input'),bug==='stale_look'?seen:no,seen)),
   fg:when(op.is('Peek'),app,when(op.is('Input').and(bug==='stale_look'?no:yes),0,fg)),
   installed:op.is('Install').and(bug==='install_unlocked'?yes:bug==='write_any'?held:held.and(owner.eq(a))),
   typed:op.is('Input').and(bug==='wrong_foreground'?yes:seen.and(fg.eq(app)))}
 })
}
// Pure predicates: fsm.bend:246-251,300-305; Python:162-163,183-184.
export const needsKevin = (phase:any,bug?:Bug)=>bug==='no_queue'?no:phase.is('Overdue')
export const leaseHolds=(held:any,owner:any,a:any,bug?:Bug)=>held.and(bug==='write_any'?yes:owner.eq(a))
export const bendMutants = [
 ['M01','lease_steal','Acquire on held lease steals'],['M02','lease_release','Anyone releases'],['M03','write_any','Anyone writes'],
 ['M04','no_overdue','No overdue'],['M05','silent_complete','Interrupted finish completes'],['M06','restart_clock','Overdue restarts clock'],
 ['M07','drop_adoption','Resume drops bg'],['M08','no_stall','No stall'],['M09','no_interrupt','No interruption'],
 ['M10','abandon_bg','Abandon with bg'],['M11','integrate_bg','Integrate with bg'],['M12','placement','No placement guard'],
 ['M13','exception','NoExc is declared'],['M14','install_unlocked','Install unlocked'],['M15','phone_steal','Phone lock steals'],
 ['M16','wrong_foreground','Type without matching foreground'],['M17','stale_look','Input retains observation']
] as const
