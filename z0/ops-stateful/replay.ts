import {readFileSync,writeFileSync} from 'node:fs'
import {watch} from '../../core/watch.ts'
import {extras} from './laws.ts'
import * as P from './port.ts'
const load=(n:string)=>JSON.parse(readFileSync(n,'utf8'))
const oracle=load('out/oracle.json')
const rows:any[]=[],divergences:any[]=[]
function runner(id:string,params:any={}) {
 const c:any=extras.find(x=>x.law_id===id)!.case(), r=c.rule, p=r.encodeParams(params), run=r.interpreter()
 let st=run.init(p),count=0
 const ws=[...c.laws,...(c.steps??[])].map((l:any)=>watch(r.machine,run,l,p,5))
 if(!ws.every((w:any)=>w.start(st)))throw Error('start law')
 return {step(input:any){const b=st,q=r.encodeInput(input);st=run.step(p,st,q);count++;if(!ws.every((w:any)=>w.step(b,q,st)))throw Error('run law');return r.decode(st)},get count(){return count}}
}
const t2=load('o2.json'),s=runner('served-revision-stable-outside-transaction')
function reflog(a:string){return a.startsWith('commit')?'commit':a.includes('Fast-forward')?'merge-ff':a.startsWith('merge')?'merge':/^(checkout|reset)/.test(a)?'checkout':'edit'}
for(const [i,it] of t2.items.entries()){
 const op=reflog(it.action),allowed=P.worktree().run({served:true,op,txn:false}).allowed===1
 const a=s.step({event:'git',op,target:i+1})
 rows.push({law:'o2',index:i,allowed,state:a})
 if(allowed||a.rev!==0)divergences.push({law:'o2',index:i,classification:'adapter bug',a})
}
const t3=load('o3.json')
for(const [i,it] of t3.items.entries()){
 const check=it.check_kind==='adb'&&it.device_launch_result.startsWith('pass'),q={...it.req,check}
 const out=['refused','deferred','promoted','rolled-back'][P.rollout().run(q).out]
 const r=runner('promotion-launch-before-claim'),base={...q,resetOK:true}
 let a=r.step({...base,event:'admit'})
 if(a.phase==='merged'){
  a=r.step({...base,event:'restart'});a=r.step({...base,event:'finish'})
  if(a.phase==='rollback-pending')a=r.step({...base,event:'rollback'})
 }
 rows.push({law:'o3',index:i,outcome:out,state:a,steps:r.count})
 if(out!==it.expect||(out==='promoted'||out==='rolled-back')&&a.phase!==out)divergences.push({law:'o3',index:i,classification:'adapter bug',expected:it.expect,out,state:a})
}
const t8=load('o8.json'),h=runner('health-once-over-arbitrary-run',{lim:t8.limit_s})
const nodeOracle=oracle.rows.filter((r:any)=>r.scope==='tape-o8')
let expectedEmitted=0
let emitted=0,firstHistoricalDifference:any=null
for(const [i,it] of t8.items.entries()){
 const a=h.step({ok:it.healthy,now:it.ts,delivered:false})
 const expected=nodeOracle[i].expected
 expectedEmitted=it.healthy?0:expectedEmitted+expected.emit
 if(a.kind!==P.nodeKinds[expected.kind]||a.since!==expected.since||a.emitted!==expectedEmitted)divergences.push({law:'o8',index:i,classification:'adapter bug',expected,expectedEmitted,state:a})
 const delta=a.emitted-emitted
 if(delta>0&&!firstHistoricalDifference)firstHistoricalDifference={index:i,timestamp:it.ts,recorded_action:it.action,gate_emission:delta,classification:'intentional rule difference',note:'The counterfactual guard emits; the actual fleet trace did not. This is the original incident, not a port/twin divergence.'}
 emitted=a.emitted
 rows.push({law:'o8',index:i,state:a})
}
const t9=load('o9.json'),stock9=oracle.stock_replay.find((x:any)=>x.law==='o9')
const gatewayChanged=['gateway_invocation','hermes_head'].some(k=>t9.before[k]&&t9.before[k]!==t9.after[k])
for(const [i,unit] of Object.keys(t9.before.units).entries()){
 const r=runner('restart-interrupted-never-silent-failure',{gateway:1})
 const a=r.step({ev:gatewayChanged?'gw-restart':'report',x:1,session:false})
 rows.push({law:'o9',index:i,outcome:a.kind,state:a,stock:stock9.rows[i].outcome})
 if(a.kind!==t9.expect||a.kind!==stock9.rows[i].outcome)divergences.push({law:'o9',index:i,classification:'adapter bug',a})
}
const out={method:'Four private incident tapes, exact stock ops_replay mappings; stock Python summaries and per-call oracle decisions; composed run interpreter watched by core/watch.ts; no original event/action normalized away',counts:{o2:t2.items.length,o3:t3.items.length,o8:t8.items.length,o9:Object.keys(t9.before.units).length,total:rows.length},stock_replay:oracle.stock_replay,rows,divergences,first_historical_difference:firstHistoricalDifference,scope:'O2/O3 counterfactual guarded execution, not replay of original unguarded physical IO. O8 full timestamp probes. O9 missing-worker snapshot converted to one restart per dependent worker, as stock guard does; no inferred session identities or resume events.',ok:divergences.length===0&&oracle.stock_replay.every((r:any)=>r.summary.ok)}
writeFileSync('out/replay.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({counts:out.counts,stock:out.stock_replay.map((r:any)=>({law:r.law,summary:r.summary})),divergences,firstHistoricalDifference,ok:out.ok}))
if(!out.ok)process.exitCode=1
