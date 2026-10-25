// Seeded full-document comparisons to real pinned checker; no verifier executes.
import {writeFileSync} from 'node:fs'
import * as C from './vendor/checker.js'
import {baseFixture,addSyntheticReceipt,approve,portCheck,twinObservation} from './adapter.ts'
let seed=501;const rand=(n:number)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n}
const divergences:any[]=[],counts:Record<string,number>={};let agree=0,positive=0,negative=0
for(let i=0;i<12000;i++) {
 const mode=i%12,doc=baseFixture(),t=doc.plan.bindings['task:1'],options:any={}
 const success=rand(2)===0
 if([2,3,4,5,10,11].includes(mode))addSyntheticReceipt(doc,mode===4)
 const execution=doc.eventLog.find((e:any)=>e.payload.kind==='tool_result'),v=doc.eventLog.find((e:any)=>e.payload.kind==='verified')
 switch(mode) {
 case 0:options.mutating=rand(2)===0;if(success)approve(doc);else if(rand(2)===0){approve(doc);doc.plan.bindings.approval.approved_by='agent'}break
 case 1:options.turnEnd=rand(2)===0;if(rand(2)===0)C.registerDelegate(doc,'task:1','worker:1',{live:success});break
 case 2:{const k=['verified','passed','executed','exitCode','isError'][rand(5)];if(!success){if(k==='verified'||k==='passed')v.payload[k]=false;else execution.payload[k]=k==='executed'?false:k==='exitCode'?1:true}options.claims=['task:1'];break}
 case 3:{const start=Date.parse(t.askedAt)+(rand(5)-1)*1000,finish=start+(rand(4)-1)*1000;execution.payload.startedAt=v.payload.startedAt=new Date(start).toISOString();execution.payload.finishedAt=v.payload.finishedAt=new Date(finish).toISOString();options.claims=['task:1'];break}
 case 4:{const result=doc.eventLog.find((e:any)=>e.payload.kind==='delegate_result');if(!success){if(rand(2))t.delegate.resultReceived=false;else result.payload.timestamp='2026-01-01T00:00:02.000Z'}break}
 case 5:if(!success){const k=rand(3);if(k===0)execution.payload.target+=':wrong';if(k===1)v.payload.target+=':wrong';if(k===2)doc.plan.bindings[t.acceptance].target+=':wrong'}break
 case 6:if(success)addSyntheticReceipt(doc);options.claims=rand(2)?['task:1']:[];options.turnEnd=rand(2)===0;break
 case 7:options.relayTaskIds=success?['task:1','task:1']:[];options.forwardedTaskIds=rand(2)?['task:1']:[];break
 case 8:C.updateIntent(doc,{op:'drop',taskId:'task:1',reason:'Synthetic removed ask'});if(success)C.registerVisibleDrop(doc,'task:1','Synthetic removed ask',doc.eventLog.at(-1).eventId);options.turnEnd=true;break
 case 9:if(success)approve(doc);options.now=Date.parse(t.askedAt)+(86400+rand(4)-1)*1000;break
 case 10:if(!success) {C.appendEvent(doc,'stateUpdate',{kind:'synthetic-noise'});v.payload.verified=false}break
 case 11:for(let j=rand(8);j>0;j--)C.appendEvent(doc,'stateUpdate',{kind:'noise',ordinal:j});break
 }
 const a=portCheck(doc,options),b=twinObservation(doc,options),same=JSON.stringify(a)===JSON.stringify(b)
 counts[`mode_${mode}`]=(counts[`mode_${mode}`]??0)+1;if(b.ok)positive++;else negative++
 if(same)agree++;else if(divergences.length<100)divergences.push({sample:i,mode,classification:'adapter bug',first_difference:{port:a,twin:b},doc,options})
}
const challenges:any[]=[]
function challenge(name:string,make:()=>{doc:any,options:any},classification:string) {const {doc,options}=make(),a=portCheck(doc,options),b=twinObservation(doc,options);challenges.push({name,classification,agree:JSON.stringify(a)===JSON.stringify(b),port:a,twin:b,doc,options})}
challenge('unknown carried ID not stated by Bend subset',()=>({doc:baseFixture(),options:{relayTaskIds:['unknown:1']}}),'intentional rule difference')
challenge('verified receipt without causal execution edge',()=>{const doc=addSyntheticReceipt(baseFixture());doc.eventLog.at(-1).causalParents=[];return {doc,options:{claims:['task:1']}}},'stale or limited oracle')
challenge('verified receipt with wrong source hash',()=>{const doc=addSyntheticReceipt(baseFixture());doc.eventLog.at(-1).sourceHash='f'.repeat(64);return {doc,options:{claims:['task:1']}}},'stale or limited oracle')
challenge('fractional-second overdue boundary',()=>{const doc=baseFixture();approve(doc);return {doc,options:{now:Date.parse(doc.plan.bindings['task:1'].askedAt)+86400001}}},'intentional rule difference')
// Intentional sabotage proves differential can detect a wrong answer; production is reference.
const probe=baseFixture(),want=twinObservation(probe,{turnEnd:true}),sabotaged={...portCheck(probe,{turnEnd:true}),ok:true}
const report={seed:501,method:'12000 independently seeded canonical single-task documents; direct pinned JS checker vs compiled gate projection; modes balanced; synthetic execution payloads only, no tools run',samples:12000,agree,divergences,positive,negative,counts,challenges,sabotage:{classification:'intentional test-only sabotage',detected:JSON.stringify(sabotaged)!==JSON.stringify(want),reference:'Production JS checker is the reference; only test-owned output was changed.'},limitations:['Projection excludes sentence authenticity, canonical causal/revision/source checks, verifier implementation and human approval authenticity. Challenges retain these differences.','Seconds are exact integer Bend units; JS overdue is milliseconds, fractional second boundary is not rounded into agreement.']}
const out=process.argv.indexOf('--json');writeFileSync(process.argv[out+1],JSON.stringify(report,null,2));console.log(JSON.stringify({samples:report.samples,agree,unexpected:divergences.length,positive,negative,challenges:challenges.map(x=>({name:x.name,agree:x.agree})),sabotage:report.sabotage}))
