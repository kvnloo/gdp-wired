import {writeFileSync} from 'node:fs'
import {proveSteps} from '../../core/dsl.ts'
import {inferLaws} from '../../core/infer.ts'
import {runRule} from '../../examples/harness.ts'
import {bendLaws,extras,make,witness,violation,claim} from './laws.ts'
import {bugs,statechart,happy} from './port.ts'
const out=process.argv[process.argv.indexOf('--json')+1]||'battery.json',rows:any[]=[],start=performance.now()
const prove=(c:any,from?:'any')=>proveSteps(c.rule,c.laws,c.steps??[],{search:false,...(from?{from}:{})})
for(const e of [...bendLaws,...extras]){
 console.log('start',e.law_id)
 try{
 const c:any=e.case(),t=performance.now(),v=prove(c),ms=performance.now()-t,any=prove(c,'any')
 const runs=runRule(c.rule,c.laws,{trials:80,depth:12,bound:3},c.steps)
 const builders=c.rule.crossCheck(c.laws,c.steps,{trials:15,depth:12,bound:3})
 const broken=c.broken.map((b:any)=>{const bv=prove(b);let w:any=e.witness?.();
 if(!w?.breaks){const r=runRule(b.rule,(b.steps?.length?[]:b.laws.slice(-1)),{trials:100,depth:12,bound:3},b.steps);w={breaks:!!r.violation,detail:r}}
 if(!w?.breaks&&e.n===0){let trace=happy;if(e.law_id==='acceptance_precedes_merge_any_distance')trace=[...happy.slice(0,7),{ev:9,role:7,actor:2,sha:0,rsha:0,passed:false}];if(e.law_id==='never_merged_twice')trace=[...happy,...happy];w=violation(b,{},trace)}
 const builders=b.rule.crossCheck(b.laws,b.steps??[],{trials:15,depth:12,bound:3})
 return {name:b.name,refused:!bv.proven,verdict:bv,witness:w,builders}})
 const row={n:e.n,law:e.law_id,encoding:e.encoding,proven:v.proven,checked:v.checked,verdict:v,ms,from_any:any,from_any_original:e.n>0?prove({rule:c.rule,...{laws:claim(e.n-1,c.rule).laws??[],steps:claim(e.n-1,c.rule).steps??[]}},'any'):any,assumes:!!any.assumes,runs,builders,broken,ok:v.proven&&v.checked&&!runs.violation&&!runs.mismatch&&!builders.failure&&broken.every((b:any)=>b.refused&&b.witness?.breaks&&!b.builders.failure)}
 rows.push(row);console.log('done',e.law_id,row.ok,ms)
 }catch(err){rows.push({n:e.n,law:e.law_id,ok:false,error:String(err)});console.log(String(err))}
 writeFileSync(out,JSON.stringify({rows},null,2))
}
const mutants:any[]=[]
for(const bug of bugs){const killed:any[]=[];for(let i=0;i<15;i++){const c=make(i,bug),v=prove(c);if(!v.proven){const w=witness(i,bug);killed.push({law:bendLaws[i]!.law_id,refused:true,witness:w})}}mutants.push({bug,killed});console.log('mutant',bug,killed.map(k=>[k.law,k.witness.breaks]))}
const chart=statechart().check({bound:1,maxStates:20000})
const invariantSearch:any[]=[]
for(const i of [0,11]){const c=make(i),target=c.laws.slice(-1),baseline=proveSteps(c.rule,target,[],{search:false});const inferred=inferLaws(c.rule,target,[],{ms:2000});invariantSearch.push({law:bendLaws[i]!.law_id,baseline,inferred})}
const result={rows,mutants,chart,invariantSearch,elapsed_ms:performance.now()-start}
writeFileSync(out,JSON.stringify(result,null,2))
if(process.argv.includes('--strict')&&rows.some(r=>!r.ok))process.exit(1)
