// MBP only. Per-law evidence, no failed row hidden by the process exit code.
import {writeFileSync} from 'node:fs'
import {proveDecision,proveSteps} from '../../core/dsl.ts'
import {evalC} from '../../core/machine.ts'
import {checkCase,sampleDecision,runRule} from '../../examples/harness.ts'
import {bendLaws,extras,variants} from './laws.ts'
import * as P from './port.ts'
import {sequenceWitness} from './sequence-check.ts'
export function setDraw(d:any) {
 let met=0,checked=0,broken:any,disagreement:any
 const r=d.rule,inter=r.interpreter(),comp=r.compiled()
 for(let f=0;f<8;f++)for(let c=0;c<8;c++)for(let x=0;x<3;x++)for(let head=0;head<3;head++) {
  const Forwarded=[0,1,2].filter(k=>f&(1<<k)),Carried=[0,1,2].filter(k=>c&(1<<k))
  const input=r.encodeInput({x,head,Forwarded,Carried}),env={x,head},st={scalars:{},maps:{Forwarded:input.Forwarded,Carried:input.Carried}}
  const a=inter.step({},inter.init({}),input),b=comp.step({},comp.init({}),input)
  if(a.scalars.ok!==b.scalars.ok)disagreement={f,c,x,head}
  checked++
  if(d.given.every((g:any)=>evalC(g,env,st,r.machine))) {
   met++;if(!evalC(d.then,env,st,r.machine)&&!broken)broken={x,head,Forwarded,Carried}
  }
 }
 return {checked,met,broken,disagreement}
}
const rows:any[]=[],outIndex=process.argv.indexOf('--json'),outputPath=outIndex>0?process.argv[outIndex+1]:undefined
for(const e of [...bendLaws,...extras]) {
 const t=performance.now()
 try {
  const c=e.case()
  if(c.kind==='loop')throw Error('No loop cases in this family')
  const proofStart=performance.now()
  const v=c.kind==='decisions'?proveDecision(c.decisions[0]):proveSteps(c.rule,c.laws,c.steps??[],{search:false})
  const proof_ms=performance.now()-proofStart
  const from_any=c.kind==='decisions'?{...v,scope:'universal decision (no reachable-state premise)'}:proveSteps(c.rule,c.laws,c.steps??[],{from:'any',search:false})
  let checks:any[],brokenWitness:any
  if(e.kind==='list/set'&&c.kind==='decisions') {
   const good=setDraw(c.decisions[0]),bad=setDraw(c.broken[0].decision),bv=proveDecision(c.broken[0].decision)
   checks=[{check:'runs',ok:good.met>0&&!good.broken&&!good.disagreement,detail:good},{check:'builders',ok:!good.disagreement&&!bad.disagreement,detail:'deterministic compiled/interpreter comparison; complete 3-key sets'},
    {check:'kernel',item:'negate',ok:!bv.proven,detail:bv},{check:'counterexample',ok:!!bad.broken,detail:bad.broken}]
  }else if(c.kind==='rule') {
   // No 10-second automatic search on intentionally false variants; real traces below.
   const good=runRule(c.rule,c.laws,{trials:300,depth:24,bound:4},c.steps)
   const cb=c.rule.crossCheck(c.laws,c.steps??[],{trials:40,depth:24,bound:4})
   checks=[{check:'runs',ok:good.steps>0&&!good.violation&&!good.mismatch,detail:good},{check:'builders',ok:!cb.failure,detail:cb}]
   for(const b of c.broken) {
    const bv=proveSteps(b.rule,[],b.steps??[],{search:false})
    const rb=runRule(b.rule,[],{trials:1500,depth:24,bound:4},b.steps)
    const targeted=sequenceWitness(e.law_id,b.name)
    checks.push({check:'kernel',item:b.name,ok:!bv.proven,detail:bv},{check:'counterexample',ok:targeted.broke,detail:{random:rb,targeted}})
   }
  }else checks=checkCase(c)
  const runs=checks.filter(x=>x.check==='runs'),builders=checks.filter(x=>x.check==='builders'),br=checks.filter(x=>x.check==='counterexample'),bk=checks.filter(x=>x.check==='kernel'&&x.item!==(c.kind==='decisions'?c.decisions[0]?.name:'laws')&&x.item!=='laws')
  const row={n:e.n,law:e.law_id,src:e.src,kind:e.kind,encoding:e.encoding,proven:v.proven,checked:v.checked,verdict:v,from_any,assumes_set:!!from_any.assumes,proof_ms,ms:performance.now()-t,checks,
   brokenRefused:bk.length>0&&bk.every(x=>x.ok),brokenRun:br.length>0&&br.every(x=>x.ok),ok:false}
  row.ok=v.proven&&v.checked&&runs.length>0&&runs.every(x=>x.ok)&&builders.length>0&&builders.every(x=>x.ok)&&row.brokenRefused&&row.brokenRun
  rows.push(row);console.log(row.ok?'ok':'FAIL',e.law_id,JSON.stringify({v,from_any,ms:row.ms,fail:checks.filter(x=>!x.ok)}))
 }catch(error){rows.push({n:e.n,law:e.law_id,ok:false,error:String(error)});console.log('ERROR',e.law_id,String(error))}
 if(outputPath)writeFileSync(outputPath,JSON.stringify(rows,null,2))
}
const out=process.argv.indexOf('--json');if(out>0)writeFileSync(process.argv[out+1],JSON.stringify(rows,null,2))
console.log('COUNTS',JSON.stringify({bend:rows.filter(r=>r.n>0).length,bend_ok:rows.filter(r=>r.n>0&&r.ok).length,extras_ok:rows.filter(r=>r.n===0&&r.ok).length}))
if(process.argv.includes('--strict')&&rows.some(r=>!r.ok))process.exitCode=1
