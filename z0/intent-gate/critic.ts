// Mutation kill matrix + honest from-any/inference and positive-law probes.
import {writeFileSync} from 'node:fs'
import {proveDecision,proveSteps} from '../../core/dsl.ts'
import {evalC} from '../../core/machine.ts'
import {sampleDecision} from '../../examples/harness.ts'
import {inferLaws} from '../../core/infer.ts'
import {chart} from '../../core/chart.ts'
import {bendLaws,extras,variants,sequencePredicates,sessionHelpers} from './laws.ts'
import * as P from './port.ts'
function setWitness(d:any) {
 for(let f=0;f<8;f++)for(let c=0;c<8;c++)for(let x=0;x<3;x++)for(let head=0;head<3;head++) {
  const Forwarded=[0,1,2].filter(k=>f&(1<<k)),Carried=[0,1,2].filter(k=>c&(1<<k))
  if(Forwarded.length&&!Forwarded.includes(head))continue // source mutant's actual head
  const req=d.rule.encodeInput({x,head,Forwarded,Carried}),env={x,head},st={scalars:{},maps:{Forwarded:req.Forwarded,Carried:req.Carried}}
  if(d.given.every((c:any)=>evalC(c,env,st,d.rule.machine))&&!evalC(d.then,env,st,d.rule.machine))return {x,head,Forwarded,Carried}
 }
 return null
}
const mutants=[]
for(const [bug,g] of P.mutants) {
 const rows=[]
 for(const e of bendLaws.filter(e=>e.fns===(g==='relay'?'relay_allows':g))) {
  const d=variants.get(e.law_id)!(bug),v=proveDecision(d),w=g==='relay'?setWitness(d):sampleDecision(d,{trials:50000,bound:g==='overdue'?100000:6}).counterexample
  rows.push({law:e.law_id,proven:v.proven,checked:v.checked,refused:!v.proven,witness:w??null,killed:!v.proven&&!!w})
 }
 mutants.push({bug,gate:g,source:`d75c94439b75 bend/intent_gate/mutations.py:MUTATIONS[${Number(bug.slice(1))}]`,encoding:g==='relay'?'m19 actual head is an extra input; valid head witnesses only. m18 extensional all-head-check omission.':'exact',rows,killed:rows.some(r=>r.killed)});console.log('mutant',bug,mutants.at(-1)?.killed)
}
const pinRows=bendLaws.map(e=>{const d=variants.get(e.law_id)!(e.fns==='identity'?'pin_identity':''),v=proveDecision(d);return {law:e.law_id,proven:v.proven,checked:v.checked}})
const pinExtra=variants.get('general_identical_targets_allowed')!('pin_identity'),pinV=proveDecision(pinExtra)
const pinWitness={input:{task:1,verifier:1,result:1,acceptance:2,used:2},good:P.gate('identity').run({task:1,verifier:1,result:1,acceptance:2,used:2}),bad:P.gate('identity','pin_identity').run({task:1,verifier:1,result:1,acceptance:2,used:2})}
const sequence=[]
for(const [name,p] of Object.entries(sequencePredicates)) {
 const r=P.session(),sl=r.stepLaw(name,(_b:any,a:any)=>a.accepted.eq(1).implies(p(a)))
 const bare=proveSteps(r,[],[sl],{from:'any',search:false})
 const inference=bare.proven?null:inferLaws(r,[],[sl],{ms:2000})
 const with_helpers=proveSteps(r,sessionHelpers(r),[sl],{from:'any',search:false})
 sequence.push({name,bare,inference,with_helpers});console.log('sequence',name,JSON.stringify({bare,with_helpers,inference}))
}
const lifecycle=chart('intent lifecycle projection').states({open:{},delegated:{},dropped:{final:true},verified:{final:true}})
 .on('delegate',{from:['open','delegated'],to:'delegated'}).on('verify',{from:['open','delegated'],to:'verified'})
 .on('visible_drop',{from:['open','delegated'],to:'dropped'}).on('work',{from:['open','delegated']})
const chartCheck=lifecycle.check()
const result={mutants,total:mutants.length,killed:mutants.filter(x=>x.killed).length,pinned_identity:{all_original_laws_pass:pinRows.every(r=>r.proven&&r.checked),rows:pinRows,extra:pinV,witness:pinWitness},sequence,chart:{scope:'Derived status-transition projection only; original Bend functions are stateless decisions. No claim this chart extracts JS runtime.',check:chartCheck},generalization:extras.filter(e=>e.fns!=='session').map(e=>({law:e.law_id,verdict:proveDecision(variants.get(e.law_id)!())}))}
const i=process.argv.indexOf('--json');writeFileSync(process.argv[i+1],JSON.stringify(result,null,2));console.log(JSON.stringify({total:result.total,killed:result.killed,pin_survives:result.pinned_identity.all_original_laws_pass,chart:chartCheck}))
