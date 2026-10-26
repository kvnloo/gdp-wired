// Deterministic synthetic runs: witness fallback, never a fabricated solver result.
import {watch} from '../../core/watch.ts'
import {modelCase} from './laws.ts'
export function witness(id:string,bug:string){
 const e=(event:string,extra:any={})=>({event,host:1,t:0,successor:2,log:false,...extra})
 const interrupted=[e('Interrupt')],spawned=[e('Start'),e('Spawn'),e('Interrupt')],overdue=[...interrupted,e('Tick',{t:2})]
 const tapes:any={
 lease_no_steal:[{op:'Acquire',a:1},{op:'Acquire',a:2}],lease_release_by_holder:[{op:'Acquire',a:1},{op:'Release',a:2}],lease_free_acquires:[{op:'Acquire',a:1}],
 interrupted_can_resume:[...spawned,e('Resume',{log:true})],interrupted_can_abandon:[...interrupted,e('Abandon')],interrupted_overdue:overdue,
 interrupted_exits:[...interrupted,e('Finish')],overdue_exits:[...overdue,e('Tick',{t:3})],running_stalls:[e('Start'),e('Tick',{t:2})],stalled_interrupts:[e('Start'),e('Tick',{t:2}),e('Tick',{t:3})],
 end_needs_reaped:bug==='integrate_bg'?[e('Start'),e('Spawn'),e('Finish'),e('Integrate')]:[...spawned,e('Abandon')],
 running_is_placed:[e('Start',{host:0})],stalled_is_placed:[e('Start',{host:0}),e('Tick',{t:2})],
 install_needs_lock:bug==='write_any'?[{op:'Lock',a:1},{op:'Install',a:2}]:[{op:'Install',a:1}],install_lock_no_steal:[{op:'Lock',a:1},{op:'Lock',a:2}],input_needs_foreground:[{op:'Input',a:1,app:2}],input_needs_fresh_look:[{op:'Peek',a:1,app:1},{op:'Input',a:1,app:1},{op:'Input',a:2,app:1}],
 abandoned_never_resumes:[...interrupted,e('Abandon'),e('Resume')],resume_requires_log:[...interrupted,e('Resume')],overdue_resume_adopts:[...spawned,e('Tick',{t:2}),e('Resume',{log:true})]
 }
 const c=modelCase(id,bug),tape=tapes[id]
 if(c.kind!=='rule'||!tape)return {breaks:false,why:'no synthetic run for a decision'}
 const params={lim:1,heavy:id.includes('is_placed'),exc:0},p=c.rule.encodeParams(c.rule.machine.params.length?params:{}),run=c.rule.interpreter()
 let s=run.init(p)
 const checks=[...c.laws,...c.steps].map(w=>({name:w.name,on:watch(c.rule.machine,run,w,p,4)}))
 for(const w of checks)w.on.start(s)
 for(const [i,input] of tape.entries()){
  const values=id.startsWith('lease_')?{...input,dead:false}:id.startsWith('install_')||id.startsWith('input_')?{...input,app:input.app??0}:input
  const request=c.rule.encodeInput(values),before=s;s=run.step(p,s,request)
  for(const w of checks)if(!w.on.step(before,request,s))return {breaks:true,law:w.name,at:i,params,tape:tape.slice(0,i+1)}
 }
 return {breaks:false,params,tape}
}
