// Differential against private JSONL from the actual pinned ops.py, plus tape adapters.
import {readFileSync,writeFileSync,createReadStream} from 'node:fs'
import {createInterface} from 'node:readline'
import {evalC,numbersOf} from '../../core/machine.ts'
import {watch} from '../../core/watch.ts'
import {bendLaws} from './laws.ts'
import * as P from './port.ts'
const input=process.argv[2]!,out=process.argv[3]??'out'
const meta=JSON.parse(readFileSync(`${input}/oracle-metadata.json`,'utf8'))
const rules:any={...Object.fromEntries(Object.entries(P.constructors).map(([name,mk])=>[name,mk()])),accessibility:P.accessibility()}
const engines:any=Object.fromEntries(Object.entries(rules).map(([name,f]:any)=>{const r=name==='accessibility'?f:f.rule;return [name,{r,interpreter:r.interpreter(),compiled:r.compiled()}]}))
const counts:any={},divergences:any[]=[],groups:any={};let n=0,checks=0,watchChecks=0,sabotage:any=null
const relevant:any={placement:['o1_'],privacy:['o4_'],phone:['o5_'],accessibility:['o6_'],routing:['o7_'],resources:['o10_'],policy:['o11_','o12_'],capacity:['o13_']}
const cases=Object.fromEntries(Object.keys(rules).map(name=>[name,bendLaws.filter(e=>relevant[name].some((p:string)=>e.law_id.startsWith(p))).map(e=>e.case())]))
for await(const line of createInterface({input:createReadStream(`${input}/cases.jsonl`),crlfDelay:Infinity})) {
 if(!line)continue;const row=JSON.parse(line),{family,input:raw,expected,origin}=row;const {r,interpreter,compiled}=engines[family]
 const req=r.encodeInput(raw),st=interpreter.step({},interpreter.init({}),req),gen=compiled.step({},compiled.init({}),req),decoded=r.decode(st)
 const got=family==='accessibility'?{ok:decoded.ok}:Object.fromEntries(Object.entries(decoded).map(([k,v])=>[k.replace(/^out\./,''),v]))
 const key=origin+':'+family;counts[key]=(counts[key]??0)+1;n++
 const diff=(classification:string,detail:any)=>{if(divergences.length<20)divergences.push({index:n,family,origin,classification,detail,input:raw,tape:row.tape})}
 if(JSON.stringify(st.scalars)!==JSON.stringify(gen.scalars))diff('kernel bug',{interpreter:st.scalars,compiled:gen.scalars})
 for(const [k,v]of Object.entries(expected)){checks++;if(got[k]!==v)diff(family==='policy'?'stale or limited oracle':'adapter bug',{field:k,got:got[k],expected:v})}
 if(origin==='replay') {
  const group=groups[row.tape]??={rows:0,accepted:0,refused:0,law_watch_checks:0,expectation_checks:0};group.rows++;got.ok??=got.admits;got.ok===1?group.accepted++:group.refused++
  if(row.expect){group.expectation_checks++;if((got.ok?'allowed':'refused')!==row.expect)diff('adapter bug',{tape_expect:row.expect,got:got.ok})}
  for(const c of cases[family] as any[]) {
   if(c.kind==='rule')for(const law of c.steps??[]) {const w=watch(c.rule.machine,c.rule.interpreter(),law,{},4);if(!w.start(interpreter.init({}))||!w.step(interpreter.init({}),req,st))diff('trace divergence',{law:law.name});watchChecks++;group.law_watch_checks++}
   else for(const d of c.decisions){const env=numbersOf(req);if(d.given.every((c:any)=>evalC(c,env,{scalars:{},maps:{}},d.rule.machine))&&!evalC(d.then,env,{scalars:{},maps:{}},d.rule.machine))diff('trace divergence',{law:d.name});watchChecks++;group.law_watch_checks++}
  }
 }
 if(!sabotage&&family==='capacity'&&expected.ok===0) {const wrong=P.capacity(61).run(raw);if(wrong.ok!==expected.ok)sabotage={caught:true,classification:'intentional test-only sabotage',production_is_reference:true,input:raw,expected:expected.ok,wrong:wrong.ok}}
}
const common={method:meta.method,seed:meta.seed,source_hashes:meta.source_hashes,counts,cases:n,field_comparisons:checks,divergences,sabotage}
const parity={...common,status:divergences.length?'ISSUES':'PASS',production_cases:Object.entries(counts).filter(([k])=>k.startsWith('parity:')&&!k.endsWith(':policy')).reduce((s,[,v])=>s+Number(v),0),limited_oracle_cases:counts['parity:policy'],limitations:['O11/O12 scalar policy has no ops.py twin; its rows are an explicitly limited independent Bend transcription.','Naturals unbounded in proof; runtime differential bounded as method says.','No raw classifiers are proven; tape adapters call actual pinned classifiers.']}
const replay={status:divergences.length||meta.replay_groups.some((g:any)=>!g.oracle_expectations_ok)?'ISSUES':'PASS',tapes:meta.replay_groups.map((g:any)=>({...g,...groups[g.tape]})),watch_checks:watchChecks,divergences:divergences.filter(d=>d.origin==='replay'),method:'All five tapes read whole; unmodified Python wrapper/classifier output mapped to port interpreter + compiled engine; source laws checked on each abstract row. O4 frozen visibility and O7 JSON parser explicitly constrained.'}
writeFileSync(`${out}/parity.json`,JSON.stringify(parity,null,2));writeFileSync(`${out}/replay.json`,JSON.stringify(replay,null,2))
console.log(JSON.stringify({status:parity.status,cases:n,checks,counts,divergences:divergences.length,replay:replay.tapes.map((t:any)=>({tape:t.tape,items:t.items,rows:t.rows,ok:t.oracle_expectations_ok})),watchChecks,sabotage}))
if(parity.status!=='PASS'||replay.status!=='PASS'||!sabotage)process.exit(1)
