// Law order/names preserved from sqlite-store-laws@d2e346146380/bend/ops_fsm/LAWS.bend.
import {decisionCase, machineCase} from '../../examples/harness.ts'
import type {Entry} from '../entry.ts'
import * as P from './port.ts'
type E = any
const touched = (o:E) => o.out.eq(2).or(o.out.eq(3))
const none = () => []
export const decisionFactories = new Map<string,(bug?:string)=>any>()
function D(n:number,id:string,line:number,mk:any,given:any,then:any,bugs:string[]):Entry {
 decisionFactories.set(id,(bug?:string)=>mk(bug).law(id,given,then))
 return {n,law_id:id,src:`bend/ops_fsm/LAWS.bend:${line}`,bend:id,says:id,fns:mk.name,kind:'decide',encoding:'exact',
  case:()=>decisionCase(id,id,[mk().law(id,given,then)],bugs.map(bug=>({name:bug,why:id,decision:mk(bug).law(id,given,then)})),{bound:5})}
}
export const bendLaws:Entry[] = [
 D(5,'o2_served_refuses',102,P.worktree,(e:E,o:E)=>[e.served,o.allowed.eq(1)],(_o:E,e:E)=>e.txn.and(e.op.is('merge-ff').or(e.op.is('rollback'))),['all-ops','rollback-outside','ff-outside','ignore-lease']),
 D(6,'o2_txn_can_ff',109,P.worktree,(e:E)=>[e.served,e.txn,e.op.is('merge-ff')],(o:E)=>o.allowed.eq(1),['no-ff']),
 D(7,'o2_txn_can_rollback',112,P.worktree,(e:E)=>[e.served,e.txn,e.op.is('rollback')],(o:E)=>o.allowed.eq(1),['no-rollback']),
 D(8,'o2_rollout_ff_idle',121,P.rollout,(_e:E,o:E)=>touched(o),(_o:E,e:E)=>e.ff.and(e.idle),['ignore-ff','ignore-idle']),
 D(9,'o3_promoted_needs_clean',153,P.rollout,(_e:E,o:E)=>o.out.eq(2),(_o:E,e:E)=>e.clean,['ignore-clean']),
 D(10,'o3_promoted_needs_check',160,P.rollout,(_e:E,o:E)=>o.out.eq(2),(_o:E,e:E)=>e.check,['promote-failure']),
 D(11,'o3_failed_check_rolls_back',167,P.rollout,(e:E,o:E)=>[e.check.not(),touched(o)],(o:E)=>o.out.eq(3),['promote-failure']),
 D(12,'o3_admissible_fail_rolls_back',179,P.rollout,(e:E)=>[P.admissible(e),e.check.not()],(o:E)=>o.out.eq(3),['defer-failure']),
 D(13,'o3_admissible_pass_promotes',185,P.rollout,(e:E)=>[P.admissible(e),e.check],(o:E)=>o.out.eq(2),['refuse-all']),
 D(14,'o3_promoted_needs_review',191,P.rollout,(_e:E,o:E)=>o.out.eq(2),(_o:E,e:E)=>e.gated.not().or(e.receipt),['ignore-review']),
 D(15,'o3_no_device_work_in_call',199,P.rollout,(_e:E,o:E)=>touched(o),(_o:E,e:E)=>e.call.not(),['ignore-call','run-deferred']),
 D(25,'o8_no_silent_strike',269,P.node,(e:E)=>[e.kind.is('bad'),e.ok.not(),e.now.gt(e.since.plus(e.lim))],(o:E)=>o.emit.eq(1),['silent']),
 D(26,'o8_notify_once',277,P.node,(e:E)=>e.kind.is('notified'),(o:E)=>o.emit.eq(0),['repeat-notice']),
 D(27,'o8_notified_sticks',283,P.node,(e:E)=>[e.kind.is('notified'),e.ok.not()],(o:E,e:E)=>o.kind.eq(2).and(o.since.eq(e.since)),['rearm']),
 D(28,'o8_emit_marks_notified',290,P.node,(_e:E,o:E)=>o.emit.eq(1),(o:E)=>o.kind.eq(2),['unmarked']),
 D(29,'o9_restart_interrupts',299,P.restart,(e:E)=>[e.kind.is('active'),e.ev.is('gw-restart'),e.x.eq(e.gw)],(o:E,e:E)=>o.kind.eq(1).and(o.gw.eq(e.gw)),['restart-ignored']),
 D(30,'o9_restart_never_fails',303,P.restart,(e:E)=>[e.kind.is('active'),e.ev.is('gw-restart')],(o:E)=>o.kind.ne(2),['restart-fails']),
 D(31,'o9_resume_needs_session',330,P.restart,(e:E,o:E)=>[e.kind.is('interrupted'),e.ev.is('resume'),o.kind.eq(4)],(_o:E,e:E)=>e.session,['sessionless']),
 D(32,'o9_interrupted_exits',336,P.restart,(e:E)=>e.kind.is('interrupted'),(o:E)=>o.kind.eq(1).or(o.kind.eq(4),o.kind.eq(5)),['interrupted-fails']),
]
const healthLaws = (r:any) => [
 r.law('at most one emission per unhealthy episode',(e:E)=>e.emitted.atMost(1)),
 r.law('before notification there has been no emission',(e:E)=>e.kind.is('notified').not().implies(e.emitted.eq(0))),
]
const servedSteps = (r:any) => [r.stepLaw('served revision stable without transaction',(e:E,a:E)=>a.rev.eq(e.rev),(e:E)=>e.txn.not())]
const promotionLaws = (r:any) => [r.law('promoted only after successful launch',(e:E)=>e.phase.is('promoted').implies(e.launchPassed))]
const restartLaws = (r:any) => [
 r.law('after interruption never silently failed or done',(e:E)=>e.everInterrupted.implies(e.kind.is('failed').not().and(e.kind.is('done').not()))),
 // Promote the critic's independently proved coherence helper: proof must not
 // depend on a wall-clock-limited synthesis pass succeeding on a busy host.
 r.law('an interrupted history is not active',(e:E)=>e.everInterrupted.implies(e.kind.is('active').not())),
]
function M(id:string,mk:any,laws:any,steps:any,bugs:string[],src:string):Entry {
 const r=mk()
 return {n:0,law_id:id,src,bend:id,says:id,fns:mk.name,kind:'step law',encoding:'abstracted',
  case:()=>machineCase(id,id,r,laws(r),bugs.map(b=>{const br=mk(b);return {name:b,why:id,rule:br,laws:laws(br),steps:steps(br)}}),{steps:steps(r),bound:5,depth:14})}
}
export const extras:Entry[] = [
 M('served-revision-stable-outside-transaction',P.servedRun,()=>[],servedSteps,['ff-outside'],'ops.bend:126; ops.py:93; guard.py:345'),
 M('promotion-launch-before-claim',P.promotionRun,promotionLaws,()=>[],['promote-failure'],'ops.bend:193; ops.py:131; guard.py:608-638'),
 M('health-once-over-arbitrary-run',P.healthRun,healthLaws,()=>[],['repeat-notice','unmarked','rearm'],'ops.bend:320-340; ops.py:235-247'),
 M('restart-interrupted-never-silent-failure',P.restartRun,restartLaws,()=>[],['interrupted-fails'],'ops.bend:396; ops.py:259'),
]
// These claims retain the incident's stronger outcome contract. They are intentionally
// NOT weakened to the finite decision table; the critic must prove or produce a run.
export const incidentClaims = [
 {id:'rollback-restores-replaced-revision',rule:P.servedRun(),steps:(r:any)=>[r.stepLaw('rollback restores replaced revision',(e:E,a:E)=>a.rev.eq(e.previous),(e:E)=>e.event.is('git').and(e.txn,e.op.is('rollback')))]},
 {id:'failed-check-never-left-live',rule:P.promotionRun(),laws:(r:any)=>[r.law('failed check never left live',(e:E)=>e.checkFailed.implies(e.candidateLive.not()))]},
 {id:'rolled-back-means-physical-rollback-succeeded',rule:P.promotionRun(),laws:(r:any)=>[r.law('rolled back means old revision live',(e:E)=>e.phase.is('rolled-back').implies(e.candidateLive.not()))]},
 {id:'notification-emission-is-owner-delivery',rule:P.healthRun(),laws:(r:any)=>[r.law('every emitted notice delivered',(e:E)=>e.deliveredCount.eq(e.emitted))]},
 {id:'interrupted-run-resolved-within-two-steps',rule:P.restartRun(),steps:(r:any)=>[r.stepsLaw('interruption resolved within two steps',2,(_e:E,a:E)=>a.kind.is('resumed').or(a.kind.is('reported')),(e:E)=>e.kind.is('interrupted'))]},
]
export const generalizations = [
 D(0,'o2_nonserved_always_allows',135,P.worktree,(e:E)=>e.served.not(),(o:E)=>o.allowed.eq(1),[]),
 D(0,'o8_recovery_rearms_every_state',320,P.node,(e:E)=>e.ok,(o:E)=>o.kind.eq(0).and(o.since.eq(0),o.emit.eq(0)),[]),
 D(0,'o9_unrelated_gateway_preserves_active',376,P.restart,(e:E)=>[e.kind.is('active'),e.ev.is('gw-restart'),e.x.ne(e.gw)],(o:E,e:E)=>o.kind.eq(0).and(o.gw.eq(e.gw)),[]),
]
