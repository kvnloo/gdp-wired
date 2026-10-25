// bun z0/ops-sqlite/run.ts --json out/battery.json [--strict]
import {writeFileSync} from 'node:fs'
import {proveDecision, proveSteps} from '../../core/dsl.ts'
import {inferLaws} from '../../core/infer.ts'
import {watch} from '../../core/watch.ts'
import {checkCase} from '../../examples/harness.ts'
import {bendLaws, extras, decisionWithBug, lifeSteps, strongProbes, type Entry} from './laws.ts'
import {lifecycle, MUTANTS, PIN} from './port.ts'
const rows:any[] = [], started = new Date().toISOString(), t0=performance.now()
const summary=(v:any)=>({proven:v.proven,checked:v.checked,assumes:v.assumes??null,goal:v.goal??null,stuck:v.stuck??null,witness:v.witness??null,found:v.found??null,run:v.run??null,why:v.why??null})
for (const e of [...bendLaws,...extras]) {
  try {
    const c=e.case(), t=performance.now()
    const v=c.kind==='decisions'?proveDecision(c.decisions[0]!):c.kind==='rule'?proveSteps(c.rule,c.laws,c.steps??[],{search:false}):undefined
    const ms=performance.now()-t
    const any=c.kind==='rule'?summary(proveSteps(c.rule,c.laws,c.steps??[],{from:'any',search:false})):{not_applicable:'stateless decision: universally quantified inputs',assumes:null}
    const checks=checkCase(c)
    const refusals=checks.filter(f=>f.check==='kernel' && f.item!==(c.kind==='rule'?'laws':c.kind==='decisions'?c.decisions[0]!.name:''))
    const breaks=checks.filter(f=>f.check==='counterexample')
    const row={n:e.n,law_id:e.law_id,law:e.bend,src:e.src,kind:e.kind,encoding:e.encoding,ms,...summary(v),from_any:any,
      brokenRefused:refusals.length>0&&refusals.every(f=>f.ok),brokenRun:breaks.map(f=>f.detail).join('; '),checks,ok:!!v?.proven&&!!v?.checked&&checks.every(f=>f.ok)&&(c.kind!=='rule'||(any.proven&&any.checked&&!any.assumes))}
    rows.push(row); console.log(`${row.ok?'ok':'FAIL'} ${e.law_id} ${ms.toFixed(2)}ms`)
  } catch(error) {rows.push({n:e.n,law_id:e.law_id,ok:false,error:String(error)});console.log('ERROR',e.law_id,String(error))}
}
const mutants=MUTANTS.map(bug=>({bug,kills:bendLaws.filter(e=>!proveDecision(decisionWithBug[e.law_id]!(bug)).proven).map(e=>e.law_id)}))
const probes=strongProbes.map(p=>{const r=lifecycle(); return {id:p.id,from_any:summary(proveSteps(r,[],[p.step(r)],{from:'any',search:false})),reachable:summary(proveSteps(r,[],[p.step(r)],{search:{ms:1000}}))}})
function trace(id:string,ops:any[],lawFactory:any,mode:'snapshot'|'atomic'='snapshot') {
  const r=lifecycle(mode), it=r.interpreter(), params=r.encodeParams({initialAuth:9}), w=watch(r.machine,it,lawFactory(r),params,10)
  let st=it.init(params);w.start(st);const steps:any[]=[]
  for(const op of ops) {const input=r.encodeInput({op:'inspect',complete:true,known:true,amount:9,actorEpoch:1,actorHasMain:true,...op} as any),before=st;st=it.step(params,st,input);steps.push({event:op,before:r.decode(before),after:r.decode(st),law_holds:w.step(before,input,st)})}
  return {id,mode,params:{initialAuth:9},steps,breaks:steps.some(s=>!s.law_holds)}
}
const witnesses=[
  trace('scan-open-replace',[{op:'scan'},{op:'open'},{op:'replace'}],lifeSteps.empty),
  trace('hidden-holder',[{op:'open-hidden'},{op:'scan'},{op:'replace'}],lifeSteps.empty),
  trace('stale-auth-baseline',[{op:'scan'},{op:'auth-write',amount:10},{op:'recreate',amount:9}],lifeSteps.auth),
  trace('partial-rejected',[{op:'scan',complete:false},{op:'recreate'}],lifeSteps.partial),
  trace('atomic-scan-open-replace',[{op:'scan'},{op:'open'},{op:'replace'}],lifeSteps.empty,'atomic'),
  trace('atomic-stale-auth-baseline',[{op:'scan'},{op:'auth-write',amount:10},{op:'recreate',amount:9}],lifeSteps.auth,'atomic'),
]
// Invariant-search battery: false step claims must not be rescued by a reachable
// invariant. Both real-run probes and the limited search result are retained.
const ir=lifecycle('atomic'), il=ir.law('auth never falls below initial count',({auth,initialAuth}:any)=>auth.atLeast(initialAuth))
const inference=summary(inferLaws(ir,[il],[],{ms:1000,runs:100,maxCandidates:1000}))
const out={family:'ops-sqlite',pin:PIN,started,finished:new Date().toISOString(),ms:performance.now()-t0,rows,mutants,probes,witnesses,inference,
  statechart:{applicable:false,reason:'Original O16 consists of stateless decisions. The added count/epoch lifecycle is a rule, not a chart.'},
  counts:{bend: bendLaws.length,bend_ok:rows.filter(r=>r.n>0&&r.ok).length,extras:extras.length,extras_ok:rows.filter(r=>r.n===0&&r.ok).length,mutants:mutants.length,mutants_killed:mutants.filter(m=>m.kills.length).length}}
const arg=process.argv.indexOf('--json');if(arg>=0)writeFileSync(process.argv[arg+1]!,JSON.stringify(out,null,2)+'\n')
console.log(JSON.stringify(out.counts))
if(process.argv.includes('--strict')&&(rows.some(r=>!r.ok)||mutants.some(m=>!m.kills.length)||witnesses.slice(0,3).some(w=>!w.breaks)||witnesses.slice(3).some(w=>w.breaks)))process.exit(1)
