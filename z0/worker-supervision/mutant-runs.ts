// Bounded concrete negative controls for every original Bend mutant.
import {writeFileSync} from 'node:fs'
import {bendMutants} from './port.ts'
import {modelCase,specs} from './laws.ts'
import {witness} from './witness.ts'
import {sampleDecision} from '../../examples/harness.ts'
const rows=bendMutants.map(([id,bug,description])=>{
 const law=id==='M11'?'end_needs_reaped':id==='M13'?'running_is_placed':specs.find(s=>s[2]===bug)![0]
 const c=modelCase(law,bug)
 const run=c.kind==='decisions'?sampleDecision(c.decisions[0],{trials:20000,bound:4}):witness(law,bug)
 const broken='breaks' in run?run.breaks:!!run.counterexample
 return {id,bug,description,law,run,broken}
})
const result={family:'worker-supervision',method:'directed synthetic interpreted run + core/watch; pure decision uses seeded sampleDecision draws',rows,ok:rows.every(r=>r.broken)}
writeFileSync('out/mutant-runs.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1
