// Unmodified real adapter files, not rewritten into an extractable toy.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
import {extract} from '../../core/extract.ts'
import {proveSteps} from '../../core/dsl.ts'
import {baseFixture} from './adapter.ts'
const files=Object.fromEntries(['intent.js','verifiers.js','checker.js'].map(f=>[f,readFileSync(new URL(`vendor/${f}`,import.meta.url),'utf8')]))
const rows=[]
for(const [file,code] of Object.entries(files)) {
 const sf=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS)
 const entries=[]
 for(const s of sf.statements) {
  if(ts.isFunctionDeclaration(s)&&s.name)entries.push(s.name.text)
  if(ts.isVariableStatement(s))for(const d of s.declarationList.declarations)if(ts.isIdentifier(d.name)&&d.initializer&&(ts.isArrowFunction(d.initializer)||ts.isFunctionExpression(d.initializer)))entries.push(d.name.text)
 }
 for(const entry of entries) {
  const t=performance.now()
  try {
   const direct=extract(code,{file,entry,files,check:{runs:100,depth:20,states:100,seed:501}})
   const profile=file==='checker.js'&&['contractHash','appendEvent','ingestUser','updateIntent','registerVisibleDrop','registerDelegate','registerDelegateResult','registerHumanApproval','receiptIssues','preconditionReceipt','verifyBinding','verifyTask','verifyPrecondition','check'].includes(entry)?baseFixture():file==='verifiers.js'&&['validateVerifier','normalizeVerifier','runVerifier'].includes(entry)?{type:'command_exit_zero',target:'artifact:synthetic',cmd:'true'}:undefined
   const x=!direct.ok&&profile?extract(code,{file,entry,files,init:profile,check:{runs:100,depth:20,states:100,seed:501}}):direct
   const attempts=[{profile:'no invented initial state',ok:direct.ok,refusals:direct.refusals},...(profile?[{profile:'canonical API-created single-task document / real command verifier binding; source unchanged',ok:x.ok,refusals:x.refusals}]:[])]
   // No substitute hand model is labelled extracted. Invariants are only proven
   // for a genuinely extracted state rule; family laws require matching fields.
   const verdict=x.ok&&x.rule?proveSteps(x.rule,x.invariants??[],[],{from:'any',search:false}):null
   rows.push({file,entry,attempts,ok:x.ok,refusals:x.refusals,evidence:x.evidence,notes:x.notes,source:x.source,verdict,
    family_laws:x.ok?'PENDING semantic mapping; no gate law inferred from an unrelated helper':'not applicable: refused',ms:performance.now()-t})
  }catch(error){rows.push({file,entry,ok:false,refusals:[{where:file,what:`extractor exception: ${String(error)}`}],ms:performance.now()-t})}
  console.log(file,entry,JSON.stringify(rows.at(-1)))
 }
}
const i=process.argv.indexOf('--json');if(i<0)throw Error('--json required')
writeFileSync(process.argv[i+1],JSON.stringify({source_sha:'d75c94439b75df1786f4cbea966992450b781a7d',method:'all top-level function and arrow declarations, whole unmodified JS file with sibling files',total:rows.length,extracted:rows.filter(r=>r.ok).length,rows},null,2))
