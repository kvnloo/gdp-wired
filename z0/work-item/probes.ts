// Additional proposed claims, never replacements for owner Bend laws.
import {writeFileSync} from 'node:fs'
import {proveSteps} from '../../core/dsl.ts'
import {arbitrary,violation,make,claim} from './laws.ts'
import {happy,lifecycle,decodeItem} from './port.ts'
const observed=arbitrary(7),drift=observed.stepLaw('accepted_drift_invalidates_acceptance',(b:any,a:any)=>a.phase.eq(5),(b:any)=>b.phase.eq(7).and(b.ev.eq(7),b.sha.eq(b.ig).not()))
const c={rule:observed,laws:[],steps:[drift]},v=proveSteps(observed,[],[drift],{from:'any',search:false})
const params={p_phase:7,p_au:1,p_ar:2,p_hd:1,p_ig:2,p_dp:0,p_ap:4,p_apr:0},input={ev:7,actor:0,role:3,sha:3,rsha:0,passed:false}
const witness=violation(c,params,[input])
const r=lifecycle(),run=r.interpreter();let st=run.init({});const trace=[...happy.slice(0,8),input,happy[8]!],states:any[]=[]
for(const e of trace){st=run.step({},st,r.encodeInput(e));states.push(decodeItem(st.scalars))}
// Raw from:any countermodels vs the same original law plus separately proven reachable invariants.
const observedStateBoundary=[0,11].map(i=>{const c=make(i),q=claim(i,c.rule);return {law:i===0?'merged_needs_owner_acceptance':'implementer_is_coder',original:proveSteps(c.rule,q.laws??[],q.steps??[],{from:'any',search:false}),with_helpers:proveSteps(c.rule,c.laws,c.steps,{from:'any',search:false})}})
const result={proposed_claim:{name:'accepted_drift_invalidates_acceptance',owner_law:false,verdict:v,witness,reachable_trace:trace,reachable_states:states,note:'The original Bend laws do not require this proposed behavior. Owner adjudication required: after acceptance, Observe drift is ignored, and Merge is still legal.'},observedStateBoundary}
writeFileSync(process.argv[2]??'probes.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))
