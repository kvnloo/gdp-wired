// Common tools worker's compiled-rule critic, supplied as private job code inputs.
// Capture callbacks before constructing cases, and NEVER mutate the source law callbacks.
import {readFileSync,writeFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
const tools=process.argv[2]!,out=process.argv[3]??'out/automatic-mutants.json'
const decisions=await import(pathToFileURL(resolve(tools,'decisions.ts')).href)
decisions.enableDecisionCapture()
const {mutateCase}=await import(pathToFileURL(resolve(tools,'mutate-tool.ts')).href)
const {bendLaws,specs}=await import('./laws.ts')
const groups=new Map<any,any>()
for(const e of bendLaws) {
 const c=e.case()
 if(c.kind==='decisions') {
  const key=specs[e.law_id]!.mk
  if(!groups.has(key))groups.set(key,{...c,name:key.name,decisions:[],broken:[],bound:5})
  groups.get(key).decisions.push(...c.decisions)
 }else groups.set('accessibility',c)
}
const rows:any[]=[];const started=performance.now()
for(const c of groups.values()) {
 const result=mutateCase(c,{cap:64,seed:1729,trials:300,depth:3,bound:5})
 rows.push({family:c.name,...result});console.log(JSON.stringify({family:c.name,supported:result.supported,summary:result.summary}))
 writeFileSync(out,JSON.stringify({tool_hashes:Object.fromEntries(['decisions.ts','mutate-tool.ts'].map(n=>[n,createHash('sha256').update(readFileSync(resolve(tools,n))).digest('hex')])),seed:1729,cap_per_rule:64,trials:300,depth:3,bound:5,scope:'The 38 original laws grouped by underlying function. Bounded structural mutation critic; survived and differing is a candidate, not automatically a production bug. Instrumentation helper reference_place is not a deployed output.',rows,wall_ms:performance.now()-started},null,2))
}
