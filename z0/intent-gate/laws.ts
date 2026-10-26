// All source law names/order from d75c94439b75 bend/intent_gate/LAWS.bend.
// Constants are substituted, never generalized silently. Extras are separate.
import {yes, no, everyKey} from '../../core/dsl.ts'
import {decisionCase, machineCase} from '../../examples/harness.ts'
import type {Entry} from '../entry.ts'
import * as P from './port.ts'
type Env = P.Env
const source='bend/intent_gate/LAWS.bend'
export const variants=new Map<string,(bug?:string)=>any>()
function D(n:number,line:number,name:string,g:string,fixed:Record<string,unknown>,given:(e:Env,o:Env)=>any,then:(o:Env,e:Env)=>any):Entry {
 const mk=(bug='')=>P.specialGate(g,fixed,bug).law(name,given,then)
 variants.set(name,mk)
 return {n,law_id:name,src:`${source}:${line}`,bend:name,says:name,fns:g,kind:'decide',encoding:g==='identity'?'interned':'exact',
  case:()=>decisionCase(name,name,[mk()],[{name:'negate',why:'negated output (test-only sabotage)',decision:mk('negate')}],{bound:g==='overdue'?100000:4})}
}
const none=()=>[]
const allowed=(_e:Env,o:Env)=>o.ok
const reject=(o:Env)=>o.ok.not()
const accept=(o:Env)=>o.ok
const field=(k:string)=>(_o:Env,e:Env)=>e[k]
function R(n:number,line:number,name:string,form:'subset'|'empty'|'missing'|'superset'):Entry {
 // Literal [1]/[0] also supplies its ground value at key 1. These are
 // redundant exact facts of those constants, not an extra caller assumption;
 // the prover otherwise misses this forall-to-ground instantiation.
 const given=(e:Env)=>form==='subset'?e.allowed.and(e.Forwarded.has(e.x)):
  form==='empty'?everyKey(k=>e.Forwarded.at(k).eq(0)):
  form==='missing'?P.setShape(e.Forwarded,[1]).and(P.setShape(e.Carried,[0]),e.Forwarded.at(1).eq(1),e.Carried.at(1).eq(0)):
  P.setShape(e.Forwarded,[2,1]).and(P.setShape(e.Carried,[0,1,2]))
 const then=(e:Env)=>form==='subset'?e.Carried.has(e.x):form==='missing'?e.allowed.not():e.allowed
 const mk=(bug='')=>P.relay(bug).decide(name,e=>given({...e,allowed:P.relayExpression(e,bug)}),e=>then({...e,allowed:P.relayExpression(e,bug)}))
 variants.set(name,mk)
 return {n,law_id:name,src:`${source}:${line}`,bend:name,says:name,fns:'relay_allows',kind:'list/set',encoding:'interned',
  note:'Characteristic sets preserve the whole relay predicate, including duplicates. m19 has a separate head input abstraction.',
  case:()=>decisionCase(name,name,[mk()],[{name:'negate',why:'test-only complement of relay predicate',decision:mk('negate')}])}
}
export const bendLaws:Entry[]=[
 D(1,13,'i0_mutation_requires_approval','authority',{mutating:true},allowed,field('approved')),
 D(2,18,'i0_qa_without_approval','authority',{mutating:false,approved:false},none,accept),
 D(3,21,'i0_approved_mutation','authority',{mutating:true,approved:true},none,accept),
 D(4,24,'i1_open_blocks_end','turn',{ending:true,status:'open'},none,reject),
 D(5,30,'i1_drop_needs_reason','turn',{ending:true,status:'dropped'},allowed,field('reason')),
 D(6,37,'i1_delegation_must_be_live','turn',{ending:true,status:'delegated'},allowed,field('live')),
 D(7,44,'i1_verified_needs_receipt','turn',{ending:true,status:'verified'},allowed,field('verified')),
 D(8,51,'i1_work_may_continue','turn',{ending:false},none,accept),
 D(9,58,'i2_needs_verified_update','proof',{},allowed,field('updated')),
 D(10,66,'i2_needs_verified_mark','proof',{},allowed,field('marked')),
 D(11,74,'i2_verifier_actually_passed','proof',{},allowed,field('passed')),
 D(12,82,'i2_tool_run_succeeded','proof',{},allowed,field('tool')),
 D(13,90,'i2_verifier_after_ask','window',{},allowed,(_o,e)=>e.start.gt(e.asked)),
 D(14,99,'i2_verifier_after_update','window',{},allowed,(_o,e)=>e.changed.atMost(e.start)),
 D(15,108,'i2_verifier_finishes_after_start','window',{},allowed,(_o,e)=>e.start.atMost(e.finish)),
 D(16,117,'i2_update_after_verifier','window',{},allowed,(_o,e)=>e.finish.atMost(e.recorded)),
 D(17,126,'i2_delegate_result_received','delegate',{delegated:true},allowed,field('received')),
 D(18,133,'i2_delegate_result_before_verifier','delegate',{delegated:true},allowed,(_o,e)=>e.result.atMost(e.start)),
 D(19,140,'i2_claim_requires_proof','claim',{},allowed,field('proof')),
 D(20,148,'i2_claim_requires_freshness','claim',{},allowed,field('fresh')),
 D(21,156,'i2_claim_requires_delegate_result','claim',{},allowed,field('delegate')),
 D(22,164,'i3_verifier_target_exact','identity',{},allowed,(_o,e)=>e.task.eq(e.verifier)),
 D(23,173,'i3_result_target_exact','identity',{},allowed,(_o,e)=>e.task.eq(e.result)),
 D(24,182,'i3_acceptance_verifier_exact','identity',{},allowed,(_o,e)=>e.acceptance.eq(e.used)),
 D(25,191,'i3_claim_requires_identity','claim',{},allowed,field('identity')),
 R(26,199,'i4_forwarded_ids_are_carried','subset'),
 R(27,207,'i4_empty_forward_is_allowed','empty'),
 R(28,211,'i4_missing_id_is_rejected','missing'),
 D(29,215,'i1_reasoned_drop_allowed','turn',{ending:true,status:'dropped',reason:true,live:false,verified:false},none,accept),
 D(30,218,'i1_live_delegation_allowed','turn',{ending:true,status:'delegated',reason:false,live:true,verified:false},none,accept),
 D(31,221,'i1_verified_end_allowed','turn',{ending:true,status:'verified',reason:false,live:false,verified:true},none,accept),
 D(32,224,'i2_successful_proof_allowed','proof',{updated:true,marked:true,passed:true,tool:true},none,accept),
 D(33,227,'i2_equal_execution_boundary_allowed','window',{asked:2,changed:3,start:3,finish:3,recorded:3},none,accept),
 D(34,230,'i2_valid_claim_allowed','claim',{proof:true,fresh:true,delegate:true,identity:true},none,accept),
 D(35,233,'i3_identical_target_allowed','identity',{task:7,verifier:7,result:7,acceptance:11,used:11},none,accept),
 R(36,236,'i4_carried_superset_allowed','superset'),
 D(37,239,'i2_execution_at_ask_rejected','window',{asked:3,changed:3,start:3,finish:3,recorded:3},none,reject),
 D(38,242,'i1_r6_unpublished_drop_open','resolved',{status:'dropped',reason:true,visible:false,returned:false,parent_verified:false},none,reject),
 D(39,245,'i1_r6_visible_drop_resolves','resolved',{status:'dropped',reason:true,visible:true,returned:false,parent_verified:false},none,accept),
 D(40,248,'i2_r6_child_completion_not_resolution','resolved',{status:'delegated',reason:false,visible:false,returned:true,parent_verified:false},none,reject),
 D(41,251,'i2_r6_parent_requires_return','resolved',{status:'delegated',reason:false,visible:false,returned:false,parent_verified:true},none,reject),
 D(42,254,'i2_r6_verified_return_resolves','resolved',{status:'delegated',reason:false,visible:false,returned:true,parent_verified:true},none,accept),
 D(43,257,'i1_r6_exact_day_not_overdue','overdue',{approved:true,unresolved:true,age:86400},none,reject),
 D(44,260,'i1_r6_old_open_reported','overdue',{approved:true,unresolved:true,age:86401},none,accept),
 D(45,263,'i1_r6_closed_not_overdue','overdue',{approved:true,unresolved:false,age:86401},none,reject),
 D(46,266,'i1_r6_unapproved_not_overdue','overdue',{approved:false,unresolved:true,age:86401},none,reject),
]
// Unbounded event-sequence statements; ghosts are last occurrences in the kept log.
// No bounded k-step replacement for 'at any distance'. Helpers are explicit.
export const sessionHelpers=(r:any)=>[
 r.law('ghost flags are bits',(e:Env)=>yes.and(...['valid','seenAsk','seenResult','delegated','accepted'].map(k=>e[k].atMost(1)))),
 r.law('seen ask has a log position',(e:Env)=>e.seenAsk.eq(1).implies(e.ask.gt(0))),
 r.law('seen result has a log position',(e:Env)=>e.seenResult.eq(1).implies(e.result.gt(0))),
 r.law('occurrences are past log positions',(e:Env)=>yes.and(...['ask','change','result','start','finish','record'].map(k=>e[k].atMost(e.events)))),
 r.law('valid start remembers a real ask',(e:Env)=>e.valid.eq(1).implies(e.seenAsk.eq(1).and(e.ask.gt(0),e.snapAsk.eq(e.ask),e.snapChange.eq(e.change),e.ask.lt(e.start),e.change.atMost(e.start)))),
 r.law('valid delegated start saw result',(e:Env)=>e.valid.eq(1).and(e.delegated.eq(1)).implies(e.snapResult.gt(0).and(e.snapResult.lt(e.start)))),
]
export const sequencePredicates={
 sequence_verifier_after_ask:(e:Env)=>e.ask.gt(0).and(e.ask.lt(e.start)),
 sequence_verifier_after_update:(e:Env)=>e.change.atMost(e.start),
 sequence_verifier_finishes_after_start:(e:Env)=>e.start.lt(e.finish),
 sequence_update_after_verifier:(e:Env)=>e.finish.lt(e.record),
 sequence_delegate_result_before_verifier:(e:Env)=>e.delegated.eq(0).or(e.snapResult.gt(0).and(e.snapResult.lt(e.start))),
}
const sequenceBugs=['skip_prereqs','ignore_change','skip_finish','skip_record','skip_prereqs']
export const extras:Entry[]=[
 ...Object.entries(sequencePredicates).map(([law_id,predicate],i):Entry=>{
  const mk=(bug='')=>{const r=P.session(bug);return {rule:r,laws:sessionHelpers(r),steps:[r.stepLaw(law_id,(_b:Env,a:Env)=>a.accepted.eq(1).implies(predicate(a)))]}}
  return {n:0,law_id,src:'checker.js:214-222; intent.bend:44-54',bend:law_id,says:'Every accepted claim has ordered logged prerequisites at arbitrary distance',fns:'session',kind:'step law',encoding:'abstracted',how:'added invariant',
   case:()=>{const good=mk(),bad=mk(sequenceBugs[i]);return machineCase(law_id,law_id,good.rule,good.laws,[{name:sequenceBugs[i],why:law_id,...bad}],{steps:good.steps,depth:24})}}
 }),
 D(0,233,'general_identical_targets_allowed','identity',{},e=>[e.task.eq(e.verifier),e.task.eq(e.result),e.acceptance.eq(e.used)],accept),
 D(0,257,'general_not_overdue_through_day','overdue',{},e=>e.age.atMost(86400),reject),
 D(0,260,'general_old_approved_open_overdue','overdue',{approved:true,unresolved:true},e=>e.age.gt(86400),accept),
 D(0,245,'general_visible_reasoned_drop_resolves','resolved',{status:'dropped',reason:true,visible:true},none,accept),
]
export const relayForms={subset:'i4_forwarded_ids_are_carried',empty:'i4_empty_forward_is_allowed',missing:'i4_missing_id_is_rejected',superset:'i4_carried_superset_allowed'}
