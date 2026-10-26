// Identical examples/harness.ts critic, plus explicitly recorded from-any verdicts.
import {writeFileSync} from 'node:fs'
import {Cond,proveDecision,proveSteps} from '../../core/dsl.ts'
import {checkCase} from '../../examples/harness.ts'
import {bendLaws,extras} from './laws.ts'
const out=process.argv[process.argv.indexOf('--json')+1]
const proofOnly=process.argv.includes('--proof-only')
const rows:any[]=[];const started=performance.now()
for(const e of [...bendLaws,...extras]) {
 let row:any={n:e.n,law:e.law_id,src:e.src,kind:e.kind,encoding:e.encoding}
 try {
  const c=e.case();const times:number[]=[];let v:any
  for(let i=0;i<5;i++){const start=performance.now();v=c.kind==='decisions'?proveDecision(c.decisions[0]!):c.kind==='rule'?proveSteps(c.rule,c.laws,c.steps??[]):undefined;times.push(performance.now()-start)}
  row={...row,proven:v?.proven,checked:v?.checked,verdict:v,ms:times.sort((a,b)=>a-b)[2]}
  if(c.kind==='rule') row.from_any=proveSteps(c.rule,c.laws,c.steps??[],{from:'any'})
  else if(c.kind==='decisions') {
   const d=c.decisions[0]!,r=d.rule.step(()=>({})),step=r.stepLaw(e.law_id,()=>new Cond(d.then),()=>new Cond({op:'and',xs:d.given}))
   row.from_any=proveSteps(r,[],[step],{from:'any'})
   row.from_any_scope='The same universal request implication as a step law on a stateless rule; no persistence or reachability claim.'
  }
  if(!proofOnly){row.checks=checkCase(c);row.brokenRefused=row.checks.filter((f:any)=>f.check==='kernel'&&f.item!== (c.kind==='rule'?'laws':c.kind==='decisions'?c.decisions[0]!.name:'loop')).every((f:any)=>f.ok); row.brokenRun=row.checks.filter((f:any)=>f.check==='counterexample').every((f:any)=>f.ok)}
  row.ok=!!(row.proven&&row.checked&&row.from_any?.proven&&row.from_any?.checked&&!row.from_any?.assumes&&(proofOnly||row.checks.every((f:any)=>f.ok)))
 }catch(err){row.error=String(err);row.ok=false}
 rows.push(row);console.log(`${row.ok?'ok':'FAIL'} ${e.law_id} ${row.ms?.toFixed(2)} ms ${row.error??''}`)
 if(!row.ok) console.log(JSON.stringify(row))
 if(out&&out!=='--json')writeFileSync(out,JSON.stringify(rows,null,2))
}
console.log(JSON.stringify({bend:rows.filter(r=>r.n).length,ok:rows.filter(r=>r.ok).length,total:rows.length,wall_ms:performance.now()-started}))
if(process.argv.includes('--strict')&&rows.some(r=>!r.ok))process.exit(1)
