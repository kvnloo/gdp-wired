// Exhaustive bounded finite domains, plus seeded large/list cases, streaming.
// bun z0/ops-sqlite/parity.ts --ops oracle_ops.py --guard oracle_guard.py --json out/parity.json
import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
import {readFileSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {auth,replace,holders,sidecar,decide,PIN} from './port.ts'
const arg=(k:string,fallback:string)=>{const i=process.argv.indexOf(k);return i<0?fallback:process.argv[i+1]!}
const ops=arg('--ops','oracle_ops.py'), guard=arg('--guard','oracle_guard.py'), tape=arg('--tape','')
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex')
const child=spawn('python3',['z0/ops-sqlite/oracle.py','--ops',ops,'--guard',guard,...(tape?['--tape',tape]:[])],{stdio:['ignore','pipe','inherit']})
const exited=new Promise<number>((resolve,reject)=>{child.on('error',reject);child.on('close',code=>resolve(code??-1))})
const funs:any={'ops.replace':replace(),'ops.holders':holders(),'ops.sidecar':sidecar(),'ops.auth.bounded':auth(),'ops.auth.seeded':auth(),'ops.auth.edges':auth()}
const stable=(x:any):string=>JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)
let total=0,mismatches=0,sabotage:any=null
const counts:Record<string,number>={}, divergences:any[]=[],steps:any[]=[],started=new Date().toISOString()
for await(const line of createInterface({input:child.stdout!})) {
  if(!line.trim())continue
  const row=JSON.parse(line);total++;counts[row.group]=(counts[row.group]??0)+1
  const got=row.group.startsWith('ops.')?funs[row.group].run(row.input):decide(row.input)
  const ok=stable(got)===stable(row.expected)
  if(!ok){mismatches++;if(divergences.length<20)divergences.push({classification:'adapter bug',index:total,...row,got})}
  if(row.group==='tape'){
    const gotLaws=got.violations.map((v:any)=>v.law), tapeOK=stable(gotLaws)===stable(row.expected_laws)
    if(!tapeOK){mismatches++;divergences.push({classification:'trace divergence; stale or limited oracle',index:row.index,expected:row.expected_laws,got:gotLaws})}
    steps.push({index:row.index,label:row.label,provenance:row.label.startsWith('hypothetical')?'hypothetical':'reconstructed historical parent evidence, not live',accepted:ok&&tapeOK,laws:gotLaws,authorization:got.authorization})
  }
  // Intentional test-only sabotage proves this differential can fail. Production
  // is the reference. Never classify the changed authorization as a real bug.
  if(!sabotage&&!row.group.startsWith('ops.')) {
    const bad=decide(row.input,true)
    sabotage={classification:'intentional test-only sabotage',production_is_reference:true,detected:stable(bad)!==stable(row.expected),first_input:row.input,field:'authorization',expected:false,got:true}
  }
}
const code=await exited
const result={family:'ops-sqlite',pin:PIN,started,finished:new Date().toISOString(),oracle_exit:code,
  oracle_hashes:{ops:hash(ops),sqlite_guard:hash(guard),...(tape?{tape:hash(tape)}:{})},
  method:tape?'Every tape item independently, full decision result vs Python, violation order vs tape; NOT a complete sequential process history.':
    'Exhaustive Bool tables; auth known x 0..10 x 0..10, 7x7 edges, 1000 seeded 40-bit samples. Guard: every ordered list length 0..2 over 16 holder records (pid 1/2, path DB/WAL/SHM/other, ghost Bool), complete Bool, before/after null/0/1/9/10, six operations, actor null/0/1/2/3; plus 1000 seeded lists length 0..12. Full result equality, no normalization of discrepancies.',
  seed:tape?null:16016,total,counts,mismatches,divergences,sabotage,steps,
  limits:['Nat/count domain and holder lists are unbounded: exhaustive means the declared finite quotient/bound, not all integers or OS processes.',
    'Only pure sqlite_decision and ops tables called. /proc scanning, auth snapshots, metadata identity and live IO are NOT exercised.',
    'Boolean list summaries are abstracted; list-to-summary translation is differentially exercised, not formally proven.'],
  ok:code===0&&total>0&&mismatches===0&&!!sabotage?.detected}
writeFileSync(arg('--json',tape?'replay.json':'parity.json'),JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({total,counts,mismatches,ok:result.ok,oracle_exit:code}))
if(!result.ok)process.exit(1)
