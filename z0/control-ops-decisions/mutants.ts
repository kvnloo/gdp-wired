// Full per-mutant kill matrix within each affected function; other functions are unchanged.
import {readFileSync,writeFileSync} from 'node:fs'
import {proveDecision,proveSteps} from '../../core/dsl.ts'
import {evalC} from '../../core/machine.ts'
import {sampleDecision,runRule} from '../../examples/harness.ts'
import {bendLaws,specs} from './laws.ts'
const catalog=JSON.parse(readFileSync(process.argv[2]!,'utf8')),out=process.argv[3]??'out/mutants.json'
const rows:any[]=[];const started=performance.now()
for(const mutant of catalog) {
 const target=specs[mutant.law],kills:any[]=[],cells:any[]=[]
 for(const e of bendLaws) {
  if(e.law_id==='o6_a11y_superset') {
   if(![29,30,31].includes(mutant.id)){cells.push({law:e.law_id,status:'unaffected'});continue}
   const c=e.case();if(c.kind!=='rule')throw Error('expected a rule')
   const b=c.broken.find(b=>b.name===`mutant-${mutant.id}`)!;const v=proveSteps(b.rule,b.laws,b.steps??[],{search:false})
   const run=runRule(b.rule,b.laws,{trials:2000,depth:3,bound:4},b.steps)
   const killed=!v.proven&&!!run.violation
   const cell={law:e.law_id,killed,verdict:v,run};cells.push(cell);if(killed)kills.push(cell)
   continue
  }
  const s=specs[e.law_id]!
  if((!target||s.mk!==target.mk)&&!([3,4].includes(mutant.id)&&e.law_id.startsWith('o10_'))){cells.push({law:e.law_id,status:'unaffected'});continue}
  const d=s.mk(mutant.id).law(e.law_id,s.given,s.then),v=proveDecision(d)
  let witness:any=null
  if(!v.proven) {
   const env=v.witness as any,empty={scalars:{},maps:{}}
   try{if(env&&d.given.every(c=>evalC(c,env,empty,d.rule.machine))&&!evalC(d.then,env,empty,d.rule.machine))witness=env}catch{}
   if(!witness){const c=e.case();if(c.kind==='decisions')d.rule.randomInput=c.decisions[0]!.rule.randomInput.bind(c.decisions[0]!.rule);witness=sampleDecision(d,{trials:50000,bound:5}).counterexample??null}
  }
  const killed=!v.proven&&!!witness,cell={law:e.law_id,killed,proven:v.proven,checked:v.checked,witness,reason:!v.proven&&!witness?'unproven is not a semantic kill':undefined}
  cells.push(cell);if(killed)kills.push(cell)
 }
 const row={...mutant,killed:kills.length>0,kills:kills.map(k=>k.law),cells};rows.push(row)
 console.log(JSON.stringify({id:mutant.id,killed:row.killed,kills:row.kills}))
 writeFileSync(out,JSON.stringify({source:'d2e346146380:bend/ops_fsm/mutations.py',rows,total:catalog.length,killed:rows.filter(r=>r.killed).length,wall_ms:performance.now()-started},null,2))
}
if(rows.some(r=>!r.killed))process.exit(1)
