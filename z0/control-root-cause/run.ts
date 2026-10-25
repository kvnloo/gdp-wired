// MBP only: faithful law proofs + template triple check + mutation kill matrix.
import {mkdirSync, writeFileSync} from 'node:fs'
import {bool, oneOf, proveDecision, proveSteps, rule} from '../../core/dsl.ts'
import {checkCase, sampleDecision} from '../../examples/harness.ts'
import {bendLaws, extras, rootLaw} from './laws.ts'
import * as P from './port.ts'
const start = performance.now()
const fromAny: Record<string,any> = {}
for (const id of Object.keys(P.fields)) {
 const r=P.observe(id), s=r.stepLaw('recompute, never retain previous verdict',(e:any,a:any)=>a.out.eq(P.rootTerm(id)(e)))
 fromAny[id]=proveSteps(r,[],[s],{from:'any'})
}
for (const id of ['lease','placement','finish']) {
 const r= id==='lease' ? rule(id).inputs(Object.fromEntries(P.leaseFields.map(f=>[f,bool]))).state({out:0}).step((e:any)=>({out:P.leaseTerm(e)}))
 : id==='placement' ? rule(id).inputs({available:bool,agent:bool,scoped:bool}).state({out:0}).step((e:any)=>({out:P.placementTerm(e)}))
 : rule(id).inputs({v:oneOf('unknown','pass','violation'),failed:bool}).state({out:0}).step((e:any)=>({out:P.finishTerm(e)}))
 const term = id==='lease' ? P.leaseTerm : id==='placement' ? P.placementTerm : P.finishTerm
 fromAny[id]=proveSteps(r,[],[r.stepLaw('recompute',(e:any,a:any)=>a.out.eq(term(e)))],{from:'any'})
}
const rows:any[]=[]
for (const e of [...bendLaws,...extras]) {
 try {
  const c=e.case(), times:number[]=[], verdicts:any[]=[]
  for(let i=0;i<5;i++) { const t=performance.now(); verdicts.push(c.kind==='decisions'?proveDecision(c.decisions[0]!):c.kind==='rule'?proveSteps(c.rule,c.laws,c.steps??[]):null);times.push(performance.now()-t) }
  times.sort((a,b)=>a-b)
  const checks=checkCase(c), v=verdicts[0]
  const any=c.kind==='rule'?proveSteps(c.rule,c.laws,c.steps??[],{from:'any'}):fromAny[e.law_id.startsWith('r3_result')?'finish':e.law_id.startsWith('g_')?'lease':e.law_id.startsWith('r')?e.law_id.split('_')[0]!:'placement']
  const ok=checks.every(x=>x.ok)&&v.proven&&v.checked&&(!any||any.proven&&any.checked&&!any.assumes)
  rows.push({n:e.n,law_id:e.law_id,law:e.bend,kind:e.kind,encoding:e.encoding,src:e.src,proven:v.proven,checked:v.checked,ms:times[2],from_any:any??{not_applicable:'pure two-call function, no stored state',assumes:false},assumes:!!v.assumes,checks,brokenRefused:checks.filter(x=>x.check==='kernel').every(x=>x.ok),brokenRun:checks.filter(x=>x.check==='counterexample').every(x=>x.ok),ok})
  console.log(`${ok?'ok':'FAIL'} ${e.law_id} ${times[2]!.toFixed(2)}ms`)
 } catch(error) { rows.push({n:e.n,law_id:e.law_id,ok:false,error:String(error)});console.log('ERROR',e.law_id,String(error)) }
}
const mutants:any[]=[]
function mutant(family:string,bug:string,ds:any[]) {
 const kills=[]
 for(const d of ds) { const v=proveDecision(d);if(!v.proven) {const sample=sampleDecision(d,{trials:50000,bound:4});kills.push({law:d.name,refused:true,witness:sample.counterexample??null,real_break:!!sample.counterexample,verdict:v})} }
 mutants.push({family,bug,kills,killed:kills.some(k=>k.real_break)})
}
for(const m of P.rootMutants) mutant(m.id,m.bug,bendLaws.filter(e=>e.law_id.startsWith(m.id+'_')&&!e.law_id.startsWith('r3_result')).map(e=>rootLaw(m.id,e.law_id,m.bug)))
for(const bug of P.leaseMutants) mutant('lease',bug,bendLaws.filter(e=>e.law_id.startsWith('g_')).map(e=> {const d=e.case();if(d.kind!=='decisions')throw Error('not decision');const old=d.decisions[0]!;const f=P.lease(bug);const pos=['g_needs_expired','g_needs_allowlisted','g_needs_nonlive','g_needs_no_symlink','g_needs_archive'].indexOf(e.law_id);return f.law(e.law_id,pos>=0?(_:any,o:any)=>o.out.eq(1):(x:any)=>P.every(P.leaseFields.map(k=>x[k])),pos>=0?(_:any,x:any)=>x[P.leaseFields[pos]!]: (o:any)=>o.out.eq(1))}))
for(const [name,bug,given,want] of [
 ['unavailable_unknown','unavailable_pass',(e:any)=>e.available.not(),0],
 ['unscoped_agent_violation','unscoped_pass',(e:any)=>e.available.and(e.agent,e.scoped.not()),2],
 ['scoped_agent_pass','scoped_violation',(e:any)=>e.available.and(e.agent,e.scoped),1],
 ['non_agent_pass','non_agent_violation',(e:any)=>e.available.and(e.agent.not()),1],
] as const) mutant('placement',bug,[P.placement(bug).law(name,given,(o:any)=>o.out.eq(want))])
const chart=P.placementChart().check()
const totalMs=performance.now()-start
const receipt={family:'control-root-cause',rows,from_any:fromAny,mutants,chart,totalMs,summary:{bend_total:bendLaws.length,bend_ok:rows.filter(r=>r.n>0&&r.ok).length,extras_total:extras.length,extras_ok:rows.filter(r=>r.n===0&&r.ok).length,mutants_total:mutants.length,mutants_killed:mutants.filter(m=>m.killed).length,proof_ms:rows.filter(r=>r.n>0).reduce((s,r)=>s+(r.ms??0),0)}}
const out=process.argv.indexOf('--json');if(out>0)writeFileSync(process.argv[out+1]!,JSON.stringify(receipt,null,2))
console.log(JSON.stringify(receipt.summary),`battery ${totalMs.toFixed(0)}ms chart ${chart.ok}`)
if(process.argv.includes('--strict')&&(rows.some(r=>!r.ok)||mutants.some(m=>!m.killed)||!chart.ok))process.exit(1)
