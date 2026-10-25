import {writeFileSync} from 'node:fs'
import {proveDecision,proveSteps} from '../../core/dsl.ts'
import {checkCase} from '../../examples/harness.ts'
import {bendLaws,extras} from './laws.ts'
const rows:any[]=[]
for(const e of [...bendLaws,...extras]) {
 const t=performance.now()
 try {
  const c=e.case()
  const v=c.kind==='decisions'?proveDecision(c.decisions[0]!):c.kind==='rule'?proveSteps(c.rule,c.laws,c.steps??[]):null
  const f=checkCase(c)
  const any=c.kind==='rule'?proveSteps(c.rule,c.laws,c.steps??[],{from:'any',search:{ms:1000}}):{not_applicable:'stateless decision quantified over every input',assumes:null}
  const row={n:e.n,law:e.law_id,src:e.src,kind:e.kind,encoding:e.encoding,verdict:v,proven:!!v?.proven,checked:!!v?.checked,ms:performance.now()-t,from_any:any,assumes:!!v?.assumes,checks:f,ok:!!v?.proven&&!!v?.checked&&f.every(x=>x.ok)}
  rows.push(row);console.log(e.law_id,row.ok?'OK':'ISSUE',row.ms.toFixed(1))
 } catch(err) {rows.push({law:e.law_id,n:e.n,ok:false,error:String(err)});console.log(e.law_id,String(err))}
}
const i=process.argv.indexOf('--json');if(i>=0)writeFileSync(process.argv[i+1]!,JSON.stringify(rows,null,2)+'\n')
if(process.argv.includes('--strict')&&rows.some(r=>!r.ok))process.exitCode=1
