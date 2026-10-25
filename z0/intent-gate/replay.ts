// No private content is emitted to stdout or committed. MBP via --input only.
import {readFileSync,writeFileSync} from 'node:fs'
import * as C from './vendor/checker.js'
import {portCheck,twinObservation} from './adapter.ts'
import {session} from './port.ts'
import {sequencePredicates,sessionHelpers} from './laws.ts'
import {watch} from '../../core/watch.ts'
const arg=(flag:string)=>process.argv[process.argv.indexOf(flag)+1]
const data=JSON.parse(readFileSync(arg('--input'),'utf8'))
if(!Array.isArray(data.rows)||data.rows.length!==20)throw Error('Expected 20 reconstruction rows')
const rows:any[]=[],transcripts=new Map<string,number>();let steps=0
for(const row of data.rows) {
 const doc=C.createDocument(`replay.${row.reviewId}`),ask=row.ask
 const source=C.ingestUser(doc,{id:ask.id,timestamp:ask.timestamp,message:{role:'user',content:ask.texts.map((text:string)=>({type:'text',text}))}}),ids=[]
 for(const s of source.sentences) {
  const a=row.sentenceAnnotations.find((x:any)=>x.id===s.id&&x.text===s.text)
  if(!a)throw Error('Source sentence boundary mismatch')
  if(a.classification==='not-an-ask')C.updateIntent(doc,{op:'not-an-ask',entryId:ask.id,sentenceId:s.id,reason:a.reason})
  else {const id=`replay.${row.reviewId}.t${ids.length}`;C.updateIntent(doc,{op:'add',taskId:id,entryId:ask.id,sentenceId:s.id,target:row.target,acceptance:row.verifier});ids.push(id)}
 }
 const moment=row.momentEvidence,turnEnd=moment.role==='assistant'&&(moment.phase==='final_answer'||(!moment.phase&&moment.stopReason==='stop'))
 const options={claims:row.completionClaimObserved?ids:[],turnEnd,mutating:false}
 const a=portCheck(doc,options),b=twinObservation(doc,options)
 const stored={ok:row.gateResult.ok,laws:[...new Set(row.gateResult.violations.map((x:any)=>x.law))].sort(),openTasks:row.gateResult.openTasks}
 const live={ok:b.ok,laws:b.laws,openTasks:b.openTasks}
 // Structural replay of recorded entries only. No tool_result is turned into a
 // verifier receipt; no named delegate is made live without canonical evidence.
 const r=session(),inter=r.interpreter();let st=inter.init({}),violations=0
 const laws=sessionHelpers(r),sl=Object.entries(sequencePredicates).map(([n,p])=>r.stepLaw(n,(_b:any,a:any)=>a.accepted.eq(1).implies(p(a))))
 const watches=[...laws,...sl].map(l=>watch(r.machine,inter,l,{},4));for(const w of watches)if(!w.start(st))violations++
 for(const entry of row.recordedTranscript) {
  const input=r.encodeInput({event:entry.role==='user'?'ask':'noise',ok:false}),before=st
  st=inter.step({},st,input);steps++
  for(const w of watches)if(!w.step(before,input,st))violations++
 }
 let claimAccepted=false
 if(row.completionClaimObserved){const input=r.encodeInput({event:'claim',ok:false}),before=st;st=inter.step({},st,input);steps++;for(const w of watches)if(!w.step(before,input,st))violations++;claimAccepted=st.scalars.accepted===1}
 transcripts.set(row.failureSessionId,Math.max(transcripts.get(row.failureSessionId)??0,row.recordedTranscript.length))
 rows.push({reviewId:row.reviewId,tasks:ids.length,recordedEntries:row.recordedTranscript.length,port:a,twin:b,stored,agree:JSON.stringify(a)===JSON.stringify(b),stored_agree:JSON.stringify(stored)===JSON.stringify(live),classification:JSON.stringify(a)===JSON.stringify(b)?null:'adapter bug',sequence:{violations,claimObserved:!!row.completionClaimObserved,claimAccepted},historical_approval_count:0})
}
const result={method:'Rebuild all 20 private hypothetical contracts using pinned checker ingest/add/classification API; compare full gate observations and saved snapshots. Replay every recorded entry as user ask or uninterpreted noise through session interpreter + core/watch; no inferred receipt/delegation/approval.',rows,total:rows.length,agreement:rows.filter(x=>x.agree).length,stored_agreement:rows.filter(x=>x.stored_agree).length,distinctFailureSessions:transcripts.size,steps,violations:rows.reduce((n,r)=>n+r.sequence.violations,0),historical_approval_count:0,limitations:['Selected overlapping audit labels are not independent incidents.','No real historical contract approvals or verifier instrumentation; structural rejections are not prevention evidence.','Transcript tools remain noise; causal mapping to acceptance receipts is intentionally not invented.','I3 only checks reconstruction consistency; I4 has no historical contract IDs; I0 is excluded by nonmutating counterfactual scope.']}
writeFileSync(arg('--json'),JSON.stringify(result,null,2));console.log(JSON.stringify({total:result.total,agreement:result.agreement,stored_agreement:result.stored_agreement,steps,violations:result.violations,distinctFailureSessions:transcripts.size}))
