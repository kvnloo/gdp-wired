// Run on MBP after oracle.py; exhaustive finite inputs plus declared boundaries.
import {readFileSync, writeFileSync} from 'node:fs'
import * as P from './port.ts'
const path=process.argv[process.argv.indexOf('--oracle')+1]!
const oracle=JSON.parse(readFileSync(path,'utf8')), t=performance.now()
const fs:any={r1:P.root('r1'),r2:P.root('r2'),r3:P.r3Result(),r4:P.root('r4'),r7:P.root('r7'),lease:P.leaseEvidence(),placement:P.placementEvidence()}
const groups:Record<string,any>={}, divergences:any[]=[]
function evaluate(row:any) {
 if(row.group==='r7_boundary')return Number(P.root('r7').run(row.input).out===1)
 if(row.group==='lease_boundary') {
  const r=P.leaseObservation(), run=r.compiled(), params=r.encodeParams({created:row.input.created,ttl:row.input.ttl})
  return run.step(params,run.init(params),r.encodeInput({now:row.input.now,allowlisted:row.input.allowlisted,known_nonlive:row.input.known_nonlive,no_symlink:row.input.no_symlink,archive_ready:row.input.archive_ready})).scalars.eligible
 }
 return fs[row.group].run(row.input).out
}
function compare(row:any,index:number) {
 const actual=evaluate(row),g=groups[row.group]??={compared:0,equal:0,domains:{}}
 g.compared++;g.domains[row.domain??'fixture']=(g.domains[row.domain??'fixture']??0)+1
 if(actual===row.expected)g.equal++
 else divergences.push({index,group:row.group,input:row.input,actual,expected:row.expected,classification:'adapter bug',note:'Unadjudicated first difference; inspect port before changing any oracle.'})
}
oracle.rows.forEach(compare)
const fixture=oracle.fixture_prefixes.map((row:any,index:number)=>({...row,actual:evaluate(row),equal:evaluate(row)===row.expected,index}))
// Prove this differential can fail with deliberate test-owned output sabotage.
const sabotage=oracle.rows.find((r:any)=>r.expected===1)
const sabotageActual=evaluate(sabotage)===1?2:1
const sabotageDetected=sabotageActual!==sabotage.expected
const receipt={family:'control-root-cause',method:'Exhaustive missing/False/True products; R7 Boolean-only Python domain; eight raw non-bool values per field with true and false sibling; exact preexisting root parity cases; boundary samples as separately counted groups',seed:oracle.seed,groups,total_cases:oracle.rows.length,compared:Object.values(groups).reduce((s:number,g:any)=>s+g.compared,0),equal:divergences.length===0,divergences,source_sha256:oracle.source_sha256,python_ms:oracle.python_ms,port_ms:performance.now()-t,sabotage:{detected:sabotageDetected,classification:'intentional test-only sabotage',input:sabotage.input,production:sabotage.expected,sabotaged:sabotageActual,note:'Production is the reference; sabotage is test-owned and never applied to production or the port.'},limits:['The three-valued root R7 abstraction has no missing-evidence Python twin; only its Boolean domain is compared.','Raw thresholds, sensor correctness, paths and archive identity are not proven.','r3 gate is an intermediate eligibility predicate; Python r3 is compared with r3_result, not mistaken for the gate.']}
const replay={family:'control-root-cause',kind:'limited replay',fixture:{source:'tests/fixtures/root-cause-incident.json',synthetic:true,prefixes:fixture,compared:fixture.length,equal:fixture.every((r:any)=>r.equal)},private_histories:oracle.histories,history_rows:oracle.histories.reduce((s:number,h:any)=>s+h.rows,0),full_law_g_rows:oracle.histories.reduce((s:number,h:any)=>s+h.complete_law_g_rows,0),divergences:fixture.filter((r:any)=>!r.equal),limitations:'Reaper histories carry eligibility and liveness, but not source-bound expired/allowlist/no-symlink/archive bits. They are inventoried, not falsely replayed as complete Law G observations. No actual reaper or guard is invoked.'}
writeFileSync(process.argv[process.argv.indexOf('--json')+1]!,JSON.stringify(receipt,null,2))
writeFileSync(process.argv[process.argv.indexOf('--replay')+1]!,JSON.stringify(replay,null,2))
console.log(JSON.stringify({groups,total_cases:receipt.total_cases,equal:receipt.equal,sabotage:sabotageDetected,fixture_equal:replay.fixture.equal,history_rows:replay.history_rows,full_law_g_rows:replay.full_law_g_rows,port_ms:receipt.port_ms}))
if(!receipt.equal||!sabotageDetected||!replay.fixture.equal)process.exit(1)
