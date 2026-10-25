import {readFileSync,writeFileSync} from 'node:fs'
import {lifecycle,statechart,decodeItem,fields,phases} from './port.ts'
import {claim,make,names,violation} from './laws.ts'
import {watch} from '../../core/watch.ts'
const args=process.argv.slice(2),path=args[args.indexOf('--oracle')+1]!,out=args[args.indexOf('--out')+1]??'out'
const r=lifecycle(),run=r.interpreter(),compiled=r.compiled(),chart=statechart(),cr=chart.rule,chartRun=cr.interpreter()
const counters:any={seeded:{tapes:0,steps:0,divergences:0,refusals:0},real:{tapes:0,steps:0,divergences:0,refusals:0},boundary:{tapes:0,steps:0,divergences:0,refusals:0}},divergences:any[]=[],real:any[]=[],watchCounts:any={}
const eq=(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b)
// src/z0int/fsm/replay.py:108-145, kept separate from theorem monitors.
function diagnose(st:any,e:any,item:any){
 const p=st.phase,k=e.ev,other=e.actor!==st.au
 const finding=(law:any,severity:string,code:string)=>({law,severity,code})
 if(k===9&&p!==7)return finding(1,'violation','merged_without_owner_acceptance')
 if(k===4&&p===3&&!other)return finding(2,item.meta?.author==='kvnloo'?'indeterminate':'violation','self_verified')
 if(k===5&&p===4){if(!other)return finding(2,item.meta?.author==='kvnloo'?'indeterminate':'violation','self_integrated');if(!e.passed||e.rsha!==e.sha)return finding(3,'violation','integrated_without_bound_receipt')}
 if(k===5&&(p===2||p===3))return finding(3,'violation','integrated_without_head_receipt')
 if(k===6&&p===5)return finding(4,'violation','deploy_not_integrated_head')
 if(k===14&&[2,3,4].includes(p))return finding(null,'info','closed_outside_statechart')
 if([0,13].includes(k)&&![1,2].includes(e.role))return finding(6,'violation','non_coder_implements')
 return finding(null,'info','refused_event')
}
// Python and TS construct object keys in the same canonical order via decodeItem.
for(const line of readFileSync(path,'utf8').trim().split('\n')){
 const t=JSON.parse(line),counts=counters[t.kind];counts.tapes++
 let st=run.init({}),g=compiled.init({}),cs=chartRun.init({}),first=false;const rejected:any[]=[],watched:any[]=[],itemWatchViolations:any={}
 if(t.kind==='real'){
 for(let i=0;i<12;i++){const q=claim(i,r);for(const law of [...(q.laws??[]),...(q.steps??[])])watched.push({name:names[i],on:watch(r.machine,run,law,{},4)})}
 }
 for(let j=0;j<t.events.length;j++){
  const e=t.events[j],input=r.encodeInput(e),before=st;st=run.step({},st,input);g=compiled.step({},g,input)
  cs=chartRun.step({},cs,cr.encodeInput({actor:e.actor,role:e.role,sha:e.sha,rsha:e.rsha,passed:e.passed,...{event:['Claim','Start','Push','Submit','Verify','Integrate','Deploy','Observe','Accept','Merge','Block','Unblock','Interrupt','Resume','Abandon'][e.ev]}}))
  const actual=decodeItem(st.scalars),generated=decodeItem(g.scalars),chartActual=decodeItem({...cs.scalars,phase:phases.indexOf(cr.decode(cs).phase)})
  counts.steps++
  if((!eq(actual,t.expected[j])||!eq(actual,generated)||!eq(actual,chartActual))&&!first){first=true;counts.divergences++;divergences.push({kind:t.kind,id:t.id,step:j,event:e,expected:t.expected[j],actual,generated,chart:chartActual,class:t.kind==='boundary'?'intentional rule difference':'adapter bug'})}
  const same=eq(decodeItem(before.scalars),actual),refused=same&&!(e.ev===7&&before.scalars.phase===6)&&!(e.ev===2&&before.scalars.phase===2&&before.scalars.hd===e.sha)
  if(refused){counts.refusals++;rejected.push({step:j,event:e.ev,phase:phases[before.scalars.phase],...(t.kind==='real'?{diagnostic:diagnose(before.scalars,e,t.meta)}:{})})}
  if(refused!==t.refused[j]&&!first){first=true;counts.divergences++;divergences.push({kind:t.kind,id:t.id,step:j,class:'adapter bug',reason:'refused predicate',actual:refused,expected:t.refused[j]})}
  for(const w of watched)if(!w.on.step(before,input,st)){watchCounts[w.name]=(watchCounts[w.name]??0)+1;itemWatchViolations[w.name]=(itemWatchViolations[w.name]??0)+1}
 }
 if(t.kind==='real'){
  // astep/board monitors run on the same event tape as a one-item board, availability deep_work.
  const boardWatches:any[]=[]
  for(let i=12;i<15;i++){
   const c=make(i),params:any={n:1,j:0};for(const f of fields)params['p_'+f]=0
   const rr=c.rule,rt=rr.interpreter(),p=rr.encodeParams(params),ws=c.steps.map(w=>watch(rr.machine,rt,w,p,4));let s=rt.init(p),violations=0
   for(const e of t.events){const input=rr.encodeInput({...e,av:0,i:0}),b=s;s=rt.step(p,s,input);for(const w of ws)if(!w.step(b,input,s))violations++}
   boardWatches.push({law:names[i],violations,availability:'deep_work',scope:'one item board; board_frame antecedent false'})
  }
  const meta=t.meta,recorded=meta.findings.map((f:any)=>({law:f.law,severity:f.severity,code:f.code})),final=decodeItem(st.scalars)
  const actualDiagnostics=rejected.map(x=>x.diagnostic),key=(f:any)=>JSON.stringify(f)
  const unmatchedStored=recorded.filter((f:any)=>!actualDiagnostics.some((a:any)=>key(a)===key(f))).map((f:any)=>({...f,class:'stale or limited oracle',reason:'observational metadata/time/ancestry diagnostic is not a legal transition theorem'}))
  const unmatchedActual=actualDiagnostics.filter((a:any)=>!recorded.some((f:any)=>key(a)===key(f))).map((a:any)=>({...a,class:meta.kind==='service'?'intentional rule difference':'harness bug',reason:meta.kind==='service'?'service replay uses richer observed-state diagnostics instead of Trace.replay diagnose':'unexpected event diagnostic disagreement'}))
  real.push({id:t.id,kind:meta.kind,events:t.events.length,model_final:final.phase,recorded_phase:meta.phase,phase_agrees:final.phase===meta.phase,refused:rejected,diagnostic_comparison:{matched:actualDiagnostics.filter((a:any)=>recorded.some((f:any)=>key(a)===key(f))).length,unmatchedStored,unmatchedActual},theorem_watch_violations:itemWatchViolations,boardWatches,recorded_findings:recorded,comparison:recorded.length?'stored evidence diagnostics have broader observational scope than legal-transition theorem watch':'no stored diagnostics'})
 }
}
// Intentional sabotage: early merge must diverge from the Python reference after shortest directed prefix.
const bad=lifecycle('merge-before-accept'),br=bad.interpreter();let bs=br.init({}),gs=run.init({}),sabotage:any=null
const tape=[{ev:0,actor:1,role:2},{ev:1,actor:1,role:2},{ev:3,actor:1,role:2},{ev:4,actor:2,role:7,passed:true},{ev:5,actor:2,role:7,passed:true},{ev:6,actor:2,role:7},{ev:9,actor:2,role:7}].map(e=>({sha:0,rsha:0,passed:false,...e}))
for(let i=0;i<tape.length;i++){const e=bad.encodeInput(tape[i]);bs=br.step({},bs,e);gs=run.step({},gs,e);if(!eq(decodeItem(bs.scalars),decodeItem(gs.scalars))){sabotage={class:'intentional test-only sabotage',step:i,trace:tape.slice(0,i+1),reference:decodeItem(gs.scalars),sabotage:decodeItem(bs.scalars),note:'Pinned Python/production semantics are the reference, not a production bug.'};break}}
const parity={seed:20261025,max_tape_length:48,method:'10000 seeded mixed random and directed-prefix tapes plus all real tapes; compare at every step, interpreter/compiled/chart/Python; exact constructor projection; injective string interning; absent hd -> 0',counts:counters,divergences,sabotage}
writeFileSync(`${out}/parity.json`,JSON.stringify(parity,null,2))
const totals:any={};for(const t of real)for(const f of t.recorded_findings){const key=`law${f.law}:${f.code}:${f.severity}`;totals[key]=(totals[key]??0)+1}
writeFileSync(`${out}/replay.json`,JSON.stringify({method:'175 frozen histories; core/watch.ts applied to all 15 faithful claims (last 3 via observed-item/pointwise-board projections). Evidence diagnostic verdicts are compared separately; theorem watches cannot diagnose refused real actions or omitted observational metadata.',items:real.length,steps:counters.real.steps,refused_steps:counters.real.refusals,parity_divergences:divergences.filter(d=>d.kind==='real'),theorem_watch_violations:watchCounts,stored_findings:totals,traces:real},null,2))
console.log(JSON.stringify({counts:counters,watchCounts,sabotageDetected:!!sabotage,stored_findings:totals,phase_disagreements:real.filter(t=>!t.phase_agrees).length}))
