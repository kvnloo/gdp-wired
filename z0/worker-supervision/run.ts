// Adapted from examples/jev-fabric/run.ts. Execute only on the MBP.
import {writeFileSync} from 'node:fs'
import {proveDecision,proveSteps,proveLeadsTo,when} from '../../core/dsl.ts'
import {inferLaws} from '../../core/infer.ts'
import {checkCase,runRule,sampleDecision} from '../../examples/harness.ts'
import {bendLaws,extras,modelCase} from './laws.ts'
import {worker,bendMutants} from './port.ts'
import {witness} from './witness.ts'
const verdict=(c:any,options:any={search:false})=>c.kind==='decisions'?proveDecision(c.decisions[0]):proveSteps(c.rule,c.laws,c.steps??[],options)
const rows:any[]=[],start=performance.now()
const idx=process.argv.indexOf('--json'),out=idx>0?process.argv[idx+1]:'battery.json'
function save(){writeFileSync(out!,JSON.stringify({family:'worker-supervision',rows,wall_ms:performance.now()-start},null,2))}
for(const e of (process.argv.includes('--supplement-only')?[]:[...bendLaws,...extras])){
 try{
  const c=e.case(),t=performance.now(),v=verdict(c),ms=performance.now()-t
  const from_any=verdict(c,{from:'any',search:false})
  const checks=checkCase(c)
  for(const f of checks.filter(f=>f.check==='counterexample'&&!f.ok)){
   const w=witness(e.law_id,f.item);if(w.breaks){f.ok=true;f.detail+='; deterministic interpreted witness: '+JSON.stringify(w)}
  }
  const row={n:e.n,law:e.law_id,src:e.src,kind:e.kind,encoding:e.encoding,proven:v.proven,checked:v.checked,verdict:v,ms,from_any,assumes:!!from_any.assumes,checks,
   brokenRefused:checks.filter(x=>x.check==='kernel'&&x.item!=='laws'&&x.item!==e.law_id).every(x=>x.ok),
   brokenRun:checks.filter(x=>x.check==='counterexample').every(x=>x.ok),ok:v.proven&&v.checked&&checks.every(x=>x.ok)}
  rows.push(row);console.log(e.law_id,JSON.stringify({ok:row.ok,from_any:from_any.proven,ms}));save()
 }catch(err){rows.push({n:e.n,law:e.law_id,ok:false,error:String(err)});console.log(e.law_id,String(err));save()}
}
// Every original Bend mutant against every original law. No new law replaces the Bend suite.
const mutants=process.argv.includes('--supplement-only')?[]:bendMutants.map(([id,bug,description])=>{
 const kills=bendLaws.flatMap(e=>{const c=modelCase(e.law_id,bug),v=verdict(c);return !v.proven?[{law:e.law_id,verdict:v}]:[]})
 const broken_runs=kills.map(k=>{const c=modelCase(k.law,bug),direct=witness(k.law,bug);const run:any=direct.breaks?{deterministic:direct}:c.kind==='decisions'?sampleDecision(c.decisions[0],{trials:10000,bound:4}):runRule(c.rule,c.laws,{trials:1500,depth:30,bound:4},c.steps);return {law:k.law,run,deterministic:direct,broken:direct.breaks||!!(run.violation||run.counterexample)}})
 console.log('mutant',id,kills.map(k=>k.law).join(','))
 return {id,bug,description,killed:kills.length>0,kills,broken_runs}
})
// Structurally the chart has no stuck non-final leaves or ambiguous handlers.
const chart=worker().check({params:{lim:0,heavy:false,exc:0},bound:1,maxStates:3000})
// The isolated stalled-placement law is intentionally probed without its Running helper.
const c=worker(),r=c.rule
const stalled=c.law('stalled placement alone',e=>e.in('Stalled').implies(e.h.eq(0).not().or(e.heavy.not(),e.exc.eq(0).not())))
const alone=proveSteps(r,[stalled],[],{search:false})
const inferred=inferLaws(r,[stalled],[],{ms:3000})
// Fair Tick alone does not promise a human decision. Fair logged Resume does.
const live=(fairResume:boolean)=>r.leadsTo(fairResume?'overdue reaches decision with fair logged Resume':'overdue reaches decision with fair Tick',{
 from:({phase}:any)=>phase.is('Overdue'),to:({phase}:any)=>phase.is('Resumed').or(phase.is('Abandoned'),phase.is('Integrated')),
 rank:({phase}:any)=>when(phase.is('Overdue'),1,0),helpful:()=>fairResume?{event:7,log:1}:{event:4}
})
const liveness={fair_logged_resume:proveLeadsTo(r,[],live(true)),fair_tick_only:proveLeadsTo(r,[],live(false)),tick_only_counterexample:{params:{lim:0,heavy:false,exc:0},prefix:[{event:'Interrupt',t:0},{event:'Tick',t:1}],cycle:[{event:'Tick',t:1}],phase:'Overdue',note:'Tick is taken infinitely often; no owner decision event is required by supervision fairness alone.'}}
const generalization={already_quantified:['lease identities','arbitrary interrupted time, limit, background count and successor','all events in interrupted_exits/overdue_exits','two arbitrary actors/apps in fresh-look'],extras:extras.map(e=>e.law_id),beyond_bend:'overdue_resume_adopts is independently tested: Bend M07 is Interrupted-only.'}
const supplemental_mutants=['revive_abandoned','resume_no_log','drop_overdue_adoption'].map(bug=>({bug,
 original_suite:bendLaws.map(e=>({law:e.law_id,...verdict(modelCase(e.law_id,bug))})),
 extra_kills:extras.flatMap(e=>{const v=verdict(modelCase(e.law_id,bug));return v.proven?[]:[{law:e.law_id,verdict:v,witness:witness(e.law_id,bug)}]})
}))
const extraWitnesses={M11_integrate_with_background:witness('end_needs_reaped','integrate_bg')}
const result={family:'worker-supervision',mode:process.argv.includes('--supplement-only')?'supplement-only':'full',extraWitnesses,rows,mutants,supplemental_mutants,chart,invariant_search:{alone,inferred},liveness,generalization,wall_ms:performance.now()-start}
writeFileSync(out!,JSON.stringify(result,null,2));console.log(JSON.stringify({rows:rows.length,ok:rows.filter(r=>r.ok).length,mutants_killed:mutants.filter(m=>m.killed).length,chart:chart.ok,wall_ms:result.wall_ms}))
if(process.argv.includes('--strict')&&(rows.some(r=>!r.ok)||mutants.some(m=>!m.killed)||!chart.ok))process.exitCode=1
