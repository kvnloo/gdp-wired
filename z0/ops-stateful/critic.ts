// Critic: incident claims, from-any, invariants, charts, generalizations,
// original mutation kill matrix and mechanically generated state-write mutants.
import {writeFileSync} from 'node:fs'
import {proveDecision,proveSteps,verdictOf} from '../../core/dsl.ts'
import {proveStepLaws} from '../../kernel/prove.ts'
import {interpret} from '../../core/machine.ts'
import {watch} from '../../core/watch.ts'
import {inferLaws} from '../../core/infer.ts'
import {runRule,sampleDecision} from '../../examples/harness.ts'
import {bendLaws,extras,incidentClaims,generalizations,decisionFactories} from './laws.ts'
import * as P from './port.ts'
type E=any
const out:any={}
const synthetic:any[]=[
 {params:{},trace:[{event:'begin',op:'edit',target:0},{event:'git',op:'merge-ff',target:1},{event:'git',op:'rollback',target:2}]},
 {params:{},trace:[{event:'admit'},{event:'restart'},{event:'finish'}].map(x=>({...x,clean:true,ff:true,gated:false,receipt:false,call:false,idle:true,check:false,resetOK:false}))},
 {params:{},trace:[{event:'admit'},{event:'restart'},{event:'finish'},{event:'rollback'}].map(x=>({...x,clean:true,ff:true,gated:false,receipt:false,call:false,idle:true,check:false,resetOK:false}))},
 {params:{lim:1},trace:[{ok:false,now:0,delivered:false},{ok:false,now:2,delivered:false},{ok:false,now:3,delivered:true}]},
 {params:{gateway:1},trace:[{ev:'gw-restart',x:1,session:false},{ev:'error',x:0,session:false},{ev:'error',x:0,session:false}]},
]
function witnessed(r:any,laws:any[],steps:any[],fixture:any){
 const p=r.encodeParams(fixture.params),run=r.interpreter();let s=run.init(p)
 const ws=[...laws,...steps].map(l=>watch(r.machine,run,l,p,5));let broke=!ws.every(w=>w.start(s))
 const states=[r.decode(s)],failures:any[]=[]
 for(const [i,x] of fixture.trace.entries()){
  const q=r.encodeInput(x),b=s;s=run.step(p,s,q);states.push(r.decode(s))
  for(const [j,w] of ws.entries())if(!w.step(b,q,s)){broke=true;failures.push({step:i,law:[...laws,...steps][j].name})}
 }
 return {...fixture,states,breaks:broke,failures,lasso:JSON.stringify(states.at(-1))===JSON.stringify(states.at(-2))}
}
out.incident_claims=incidentClaims.map((c:any,i)=>{
 const ls=c.laws?.(c.rule)??[],ss=c.steps?.(c.rule)??[]
 const verdict=proveSteps(c.rule,ls,ss,{search:{ms:1500}}),any=proveSteps(c.rule,ls,ss,{from:'any',search:false})
 return {id:c.id,verdict,from_any:any,witness:witnessed(c.rule,ls,ss,synthetic[i])}
})
out.generalizations=generalizations.map(e=>{const c:any=e.case();return {id:e.law_id,verdict:proveDecision(c.decisions[0]),draws:sampleDecision(c.decisions[0],{trials:20000,bound:6})}})
out.charts=[P.servedChart,P.promotionChart,P.healthChart,P.restartChart].map(mk=>({name:mk.name,check:mk().check()}))
// Strip the hand-written helper to demonstrate that inference is actually exercised.
const hr=P.healthRun(),once=hr.law('at most one emission',(e:E)=>e.emitted.atMost(1))
const rr=P.restartRun(),never=rr.law('after interruption never failed or done',(e:E)=>e.everInterrupted.implies(e.kind.is('failed').not().and(e.kind.is('done').not())))
out.invariant_search=[{rule:'health',bare:proveSteps(hr,[once],[],{search:false}),inferred:inferLaws(hr,[once],[],{ms:15000})},
 {rule:'restart',bare:proveSteps(rr,[never],[],{search:false}),inferred:inferLaws(rr,[never],[],{ms:15000})}]
const helper=rr.law('an interrupted history is not active',(e:E)=>e.everInterrupted.implies(e.kind.is('active').not()))
out.explicit_helper_from_any=proveSteps(rr,[never,helper],[],{from:'any',search:false})
// Original mutation inventory: unique (decision family, bug) pairs are exactly
// the 23 mutations.py edits belonging to O2/O3/O8/O9, not duplicated per law.
const catalog=new Map<string,{family:string,bug:string}>()
for(const e of bendLaws){const c:any=e.case();for(const b of c.broken)catalog.set(`${e.fns}:${b.name}`,{family:e.fns,bug:b.name})}
out.original_mutants=[...catalog.values()].map(m=>{
 const kills=bendLaws.filter(e=>e.fns===m.family).map(e=>{
  const d=decisionFactories.get(e.law_id)!(m.bug),v=proveDecision(d)
  const sample=v.proven?null:sampleDecision(d,{trials:50000,bound:6})
  return {law:e.law_id,refused:!v.proven,witness:sample?.counterexample??null}
 })
 return {...m,kills:kills.filter(k=>k.refused),survives:!kills.some(k=>k.refused),broken_by_draw:kills.some(k=>k.witness)}
})
out.automatic_mutants=[]
for(const e of extras){
 const c:any=e.case(),r=c.rule,m=r.machine
 const ls=[...c.laws,...r.kindLaws()]
 if(e.law_id.startsWith('restart-'))ls.push(r.law('history excludes active',(x:E)=>x.everInterrupted.implies(x.kind.is('active').not())))
 const baseline=verdictOf(proveStepLaws(m,ls,c.steps??[]))
 for(const field of Object.keys(m.step.state??{}))for(const variant of ['zero','one','omit']){
  const expr=variant==='omit'?{op:'var',name:field}:{op:'const',value:variant==='zero'?0:1}
  if(JSON.stringify(expr)===JSON.stringify(m.step.state[field]))continue
  const mm={...m,step:{...m.step,state:{...m.step.state,[field]:expr}}}
  const fake=Object.create(r);Object.defineProperty(fake,'machine',{value:mm})
  const v=verdictOf(proveStepLaws(mm,ls,c.steps??[])),sample=runRule(fake,ls,{trials:300,depth:16,bound:5},c.steps??[])
  out.automatic_mutants.push({rule:e.law_id,field,variant,baseline,kernel_refused:!v.proven,violation:sample.violation??null,mismatch:sample.mismatch??null,classification:sample.violation?'non-equivalent killed by safety suite':'unclassified survivor or equivalent; not counted as a non-equivalent kill'})
 }
}
writeFileSync('out/critic.json',JSON.stringify(out,null,2)+'\n')
console.log(JSON.stringify({claims:out.incident_claims.map((x:any)=>({id:x.id,proven:x.verdict.proven,witness:x.witness.breaks})),generalizations:out.generalizations.map((x:any)=>({id:x.id,proven:x.verdict.proven})),original_mutants:out.original_mutants.length,original_survivors:out.original_mutants.filter((m:any)=>m.survives),automatic_mutants:out.automatic_mutants.length,automatic_witnessed_kills:out.automatic_mutants.filter((m:any)=>m.violation).length,charts:out.charts,invariant_search:out.invariant_search.map((x:any)=>({rule:x.rule,bare:x.bare.proven,inferred:x.inferred.proven,found:x.inferred.found})),helper_any:out.explicit_helper_from_any}))
if(out.incident_claims.some((x:any)=>x.verdict.proven||!x.witness.breaks)||out.original_mutants.some((x:any)=>x.survives||!x.broken_by_draw))process.exitCode=1
