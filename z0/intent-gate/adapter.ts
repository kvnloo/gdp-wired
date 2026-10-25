// Projection for the controlled canonical fixture vocabulary and replay reconstruction.
// d75c94439b75 checker.js:202-225,292-375. It is not the complete schema checker.
// Syntactic/provenance restrictions not represented by Bend are deliberately separate.
import * as C from './vendor/checker.js'
import * as P from './port.ts'
const gates=new Map(Object.keys(P.inputs).map(k=>[k,P.gate(k)]))
export const runGate=(g:string,input:Record<string,unknown>)=>gates.get(g)!.run(input).ok===true
const relay=P.relay(),compiled=relay.compiled()
export function relayAllows(forwarded:string[],carried:string[]) {
 const ids=new Map([...new Set([...forwarded,...carried])].map((x,i)=>[x,i]))
 return compiled.step({},compiled.init({}),relay.encodeInput({x:0,head:ids.get(forwarded[0])??0,Forwarded:forwarded.map(x=>ids.get(x)),Carried:carried.map(x=>ids.get(x))})).scalars.ok===1
}
export function portCheck(doc:any,options:any={}) {
 const laws=new Set<string>(),openTasks:string[]=[],overdueTasks:string[]=[],b=doc.plan.bindings,now=options.now??Date.now(),events=doc.eventLog
 const tasks=doc.intentGraph.nodes.filter((n:any)=>n.kind==='task').map((n:any)=>[n.id,b[n.id]])
 const a=b.approval,approved=Boolean(a&&a.status==='approved'&&a.approved_by==='kevin'&&Number.isFinite(Date.parse(a.approved_at))&&Date.parse(a.approved_at)<=Date.now()&&a.sourceHash===doc.provenance.sourceHash&&a.contractHash===C.contractHash(doc)&&a.contract_id&&a.session_id===(options.sessionId??b.sessionId))
 if(!runGate('authority',{mutating:!!options.mutating&&options.requiresContract!==false,approved}))laws.add('I0')
 for(const [id,t] of tasks) {
  const vs=events.filter((e:any)=>e.payload.kind==='verified'&&e.payload.taskId===id),v=vs.at(-1),p=v?.payload
  const rs=events.filter((e:any)=>e.payload.kind==='tool_result'&&e.payload.toolCallId===p?.toolCallId),r=rs[0]?.payload
  const proof=runGate('proof',{updated:!!v&&v.type==='stateUpdate'&&p.taskId===id&&p.verifierId===t.acceptance,marked:p?.verified===true,passed:p?.passed===true,tool:rs.length===1&&r?.executed===true&&r?.passed===true&&r?.exitCode===0&&r?.isError===false&&r?.taskId===id&&r?.verifierId===t.acceptance&&r?.toolName===`intent_verifier:${b[t.acceptance]?.type}`})
  const asked=Date.parse(t.askedAt),start=Date.parse(r?.startedAt),finish=Date.parse(r?.finishedAt)
  const nums=[asked,start,finish];const fresh=nums.every(Number.isSafeInteger)&&nums.every(x=>x>=0)&&runGate('window',{asked,changed:asked,start,finish,recorded:Math.max(0,Math.floor(now))})&&p?.startedAt===r?.startedAt&&p?.finishedAt===r?.finishedAt
  const delegation=events.filter((e:any)=>e.payload.kind==='delegate'&&e.payload.taskId===id).at(-1)
  const result=events.find((e:any)=>e.payload.kind==='delegate_result'&&e.payload.taskId===id&&e.payload.delegateId===t.delegate?.id&&e.payload.result!=null&&Date.parse(e.payload.timestamp)>=Date.parse(delegation?.payload.timestamp)&&events.indexOf(e)>events.indexOf(delegation)&&events.indexOf(e)<events.indexOf(rs[0]))
  const rt=Date.parse(result?.payload.timestamp)
  const delegate=!t.delegate||runGate('delegate',{delegated:true,received:t.delegate.resultReceived===true&&delegation?.payload.delegateId===t.delegate.id&&!!result,result:Number.isSafeInteger(rt)&&rt>=0?rt:0,start:Number.isSafeInteger(start)&&start>=0?start:0})
  // Injective equality classes, not fuzzy string/path matching.
  const identities=[t.target,b[t.acceptance]?.target,r?.target,t.acceptance,p?.verifierId],intern=new Map([...new Set(identities)].map((s,i)=>[s,i]))
  const identity=runGate('identity',{task:intern.get(identities[0]),verifier:intern.get(identities[1]),result:intern.get(identities[2]),acceptance:intern.get(identities[3]),used:intern.get(identities[4])})&&p?.target===t.target
  const receipt=runGate('claim',{proof,fresh,delegate,identity})
  if(t.status==='verified') {if(!proof||!fresh||!delegate)laws.add('I2');if(!identity)laws.add('I3')}
  const drop=events.filter((e:any)=>e.type==='stateUpdate'&&e.payload.kind==='drop'&&e.payload.taskId===id).at(-1)
  const request=events.find((e:any)=>drop?.causalParents?.includes(e.eventId)&&e.payload.kind==='drop_requested'&&e.payload.taskId===id&&e.payload.reason===t.reason)
  const visible=!!drop&&drop.payload.reason===t.reason&&drop.payload.publication==='native-kevin-visible'&&!!request&&events.indexOf(request)<events.indexOf(drop)
  if(t.status==='dropped'&&!runGate('resolved',{status:'dropped',reason:!!t.reason?.trim(),visible,returned:false,parent_verified:false}))laws.add('I1')
  const latest=events.filter((e:any)=>['delegate','delegate_result'].includes(e.payload.kind)&&e.payload.taskId===id).at(-1)
  const live=t.delegate?.live===true&&t.delegate?.resultReceived===false&&latest?.payload.kind==='delegate'&&latest.payload.live===true&&latest.payload.delegateId===t.delegate.id
  if(['open','delegated'].includes(t.status)) {openTasks.push(id);if(!runGate('turn',{ending:!!options.turnEnd,status:t.status,reason:false,live,verified:false}))laws.add('I1')}
  if((options.claims??[]).includes(id)&&t.status!=='verified')laws.add('I2')
  const age=Math.max(0,Math.floor((now-asked)/1000))
  // Bend age is integral seconds. Fractional-ms JS boundary is checked separately.
  if(runGate('overdue',{approved,unresolved:['open','delegated'].includes(t.status),age}))overdueTasks.push(id)
 }
 const known=new Set(tasks.map(([id]:any)=>id))
 if((options.claims??[]).some((id:string)=>!known.has(id)))laws.add('I2')
 // Bend I4 is inclusion only; known-id checking is an explicit adapter obligation.
 if(!relayAllows(options.forwardedTaskIds??[],options.relayTaskIds??[]))laws.add('I4')
 return {ok:!laws.size,laws:[...laws].sort(),openTasks,overdueTasks}
}
export function twinObservation(doc:any,options:any={}) {const r=C.check(doc,options);return {ok:r.ok,laws:[...new Set(r.violations.map((i:any)=>i.law))].sort(),openTasks:r.openTasks,overdueTasks:r.overdueTasks.map((i:any)=>i.taskId)}}
export function baseFixture() {
 const doc=C.createDocument('intent-gate-seeded'),source=C.ingestUser(doc,{id:'user:1',timestamp:'2025-12-31T23:59:59.000Z',message:{role:'user',content:'Write the artifact.'}})
 C.updateIntent(doc,{op:'add',taskId:'task:1',entryId:'user:1',sentenceId:source.sentences[0].id,target:'artifact:synthetic',acceptance:{type:'command_exit_zero',cmd:'true',target:'artifact:synthetic'}})
 return doc
}
export function addSyntheticReceipt(doc:any,delegated=false) {
 const t=doc.plan.bindings['task:1']
 if(delegated){C.registerDelegate(doc,'task:1','worker:1');doc.eventLog.at(-1).payload.timestamp='2026-01-01T00:00:00.000Z';C.registerDelegateResult(doc,'task:1','worker:1',{synthetic:true});doc.eventLog.at(-1).payload.timestamp='2026-01-01T00:00:00.000Z'}
 const p={kind:'tool_result',taskId:'task:1',verifierId:t.acceptance,toolCallId:'synthetic:1',toolName:'intent_verifier:command_exit_zero',executed:true,passed:true,exitCode:0,isError:false,target:t.target,startedAt:'2026-01-01T00:00:00.000Z',finishedAt:'2026-01-01T00:00:01.000Z'}
 const r=C.appendEvent(doc,'stateUpdate',p)
 C.appendEvent(doc,'stateUpdate',{kind:'verified',taskId:'task:1',verifierId:t.acceptance,toolCallId:p.toolCallId,verified:true,passed:true,target:t.target,startedAt:p.startedAt,finishedAt:p.finishedAt},[r.eventId]);t.status='verified'
 return doc
}
export function approve(doc:any) {doc.plan.bindings.approval={status:'approved',approved_by:'kevin',approved_at:'2026-01-01T00:00:01.000Z',sourceHash:doc.provenance.sourceHash,contractHash:C.contractHash(doc),contract_id:'synthetic:1',session_id:doc.plan.bindings.sessionId}}
