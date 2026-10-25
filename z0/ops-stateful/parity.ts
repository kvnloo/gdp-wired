import {readFileSync,writeFileSync} from 'node:fs'
import * as P from './port.ts'
const oracle=JSON.parse(readFileSync(process.argv[2]??'out/oracle.json','utf8'))
const funcs:any={worktree:P.worktree(),rollout:P.rollout(),node:P.node(),restart:P.restart()}
const counts:any={},divergences:any[]=[]
for(const [index,row] of oracle.rows.entries()) {
 const key=`${row.fn}:${row.scope}`;counts[key]=(counts[key]??0)+1
 const got=funcs[row.fn].run(row.input)
 if(JSON.stringify(got)!==JSON.stringify(row.expected))divergences.push({index,fn:row.fn,scope:row.scope,input:row.input,expected:row.expected,got,classification:'adapter bug'})
}
// Test-owned sabotage: the production Python oracle remains reference; corrupt
// exactly one port call to prove the differential harness is sensitive.
const sabotageInput={served:true,op:'merge-ff',txn:false}
const sabotage={input:sabotageInput,reference:funcs.worktree.run(sabotageInput),mutated:P.worktree('ff-outside').run(sabotageInput),classification:'intentional test-only sabotage',note:'Production Python is the reference; this mutant is deliberately wrong.'}
const out={method:'Every Bool/enum combination; O8/O9 natural grid 0..5 plus 10,000 seeded inputs each, including late boundary -1/0/+1; canonical Bend constructor payloads; tape decisions in exact order',seed:oracle.seed,total:oracle.rows.length,counts,divergences,first_divergence:divergences[0]??null,sabotage,ok:divergences.length===0&&sabotage.reference.allowed!==sabotage.mutated.allowed}
writeFileSync('out/parity.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out))
if(!out.ok)process.exitCode=1
