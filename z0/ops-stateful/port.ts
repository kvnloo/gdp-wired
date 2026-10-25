// Pinned source: sqlite-store-laws@d2e346146380 (read-only).
// Decision expressions are shared by pure ports and run models: no JS oracle hidden in the prover.
import {Choice, bool, fun, nat, no, oneOf, rule, when, yes} from '../../core/dsl.ts'
import {chart} from '../../core/chart.ts'
export const gitOps = ['edit','commit','checkout','stash','merge','merge-ff','rollback'] as const
export const nodeKinds = ['healthy','bad','notified'] as const
export const runKinds = ['active','interrupted','failed','done','resumed','reported'] as const
export const runEvents = ['gw-restart','error','done','resume','report'] as const
export const reqKinds = {clean:bool, ff:bool, gated:bool, receipt:bool, call:bool, idle:bool, check:bool}
type E = any

// ops.bend:126-140; ops.py:93-96. Each bug is the corresponding mutations.py edit.
export function wtExpr(e:E, bug?:string) {
  const ff = bug==='ff-outside' ? yes : bug==='no-ff' ? no : e.txn
  const rb = bug==='rollback-outside' ? yes : bug==='no-rollback' ? no : e.txn
  return e.served.not().or(bug==='ignore-lease' ? yes : when(e.op.is('merge-ff'), ff,
    when(e.op.is('rollback'), rb, bug==='all-ops' ? yes : no)))
}
export const worktree = (bug?:string) => fun('wt_allows').inputs({served:bool,op:oneOf(...gitOps),txn:bool})
  .returns(e=>({allowed:when(wtExpr(e,bug),1,0)}))

// ops.bend:163-213; ops.py:119-145. Out: refused=0, deferred=1, promoted=2, rolled-back=3.
export const admissible = (e:E) => e.clean.and(e.ff, e.gated.not().or(e.receipt), e.call.not(), e.idle)
export function rolloutExpr(e:E,bug?:string) {
  const review = bug==='ignore-review' ? yes : e.gated.not().or(e.receipt)
  const pre = (bug==='ignore-clean' ? yes : e.clean).and(bug==='ignore-ff'?yes:e.ff,review)
  const ready = (bug==='ignore-call' ? yes : e.call.not()).and(bug==='ignore-idle'?yes:e.idle)
  const end = when(e.check,2,bug==='promote-failure'?2:bug==='defer-failure'?1:3)
  return when(pre,bug==='refuse-all'?0:when(ready,end,bug==='run-deferred'?end:1),0)
}
export const rollout = (bug?:string) => fun('rollout').inputs(reqKinds).returns(e=>({out:rolloutExpr(e,bug)}))

// ops.bend:295-347; ops.py:231-247. State tag and constructor payload are exact.
export function nodeExpr(e:E,bug?:string) {
  const late = e.now.gt(e.since.plus(e.lim))
  const emit = (bug==='repeat-notice' ? e.kind.is('bad').or(e.kind.is('notified')) : e.kind.is('bad'))
    .and(e.ok.not(),bug==='silent'?no:late)
  const next = when(e.ok,0,when(e.kind.is('healthy'),1,
    when(e.kind.is('bad'),bug==='unmarked'?1:when(late,2,1),bug==='rearm'?1:2)))
  const since = when(e.ok,0,when(e.kind.is('healthy').or(bug==='rearm'?e.kind.is('notified'):no),e.now,e.since))
  return {kind:next,since,emit:when(emit,1,0)}
}
export const node = (bug?:string) => fun('nstep_neff').inputs({kind:oneOf(...nodeKinds),since:nat,ok:bool,now:nat,lim:nat})
  .returns(e=>nodeExpr(e,bug))

// ops.bend:376-416; ops.py:259-275. Terminal constructors carry no gateway payload.
export function restartExpr(e:E,bug?:string) {
  const interrupt = bug==='restart-fails'?2:bug==='restart-ignored'?0:when(e.x.eq(e.gw),1,0)
  const active = when(e.ev.is('gw-restart'),interrupt,when(e.ev.is('error'),2,when(e.ev.is('done'),3,0)))
  const intr = when(e.ev.is('resume'),when(bug==='sessionless'?yes:e.session,4,1),
    when(e.ev.is('report'),5,bug==='interrupted-fails'?when(e.ev.is('error'),2,1):1))
  const kind = when(e.kind.is('active'),active,when(e.kind.is('interrupted'),intr,e.kind.n))
  return {kind,gw:when(kind.atMost(1),e.gw,0)}
}
export const restart = (bug?:string) => fun('rstep').inputs({kind:oneOf(...runKinds),gw:nat,ev:oneOf(...runEvents),x:nat,session:bool})
  .returns(e=>restartExpr(e,bug))

// Composed run model, not a new assertion that guard.py is equivalent. The token is held in state.
// ops.bend:111-140; ops.py:93-96; guard.py:203,345-375. Revisions are opaque natural IDs.
export const servedRun = (bug?:string) => rule('served transaction')
  .inputs({event:oneOf('begin','end','git'),op:oneOf(...gitOps),target:nat})
  .state({txn:bool.from(false),rev:0,previous:0})
  .flags(e=>({allowed:e.event.is('git').and(wtExpr({...e,served:yes},bug))}))
  .step(e=>({txn:when(e.event.is('begin'),yes,when(e.event.is('end'),no,e.txn)),
    previous:when(e.event.is('begin'),e.rev,e.previous),rev:when(e.allowed,e.target,e.rev)}))

// Expanded O3 lifecycle. Admission and completion use rolloutExpr. External side-effect success
// is explicit, not assumed. Mirrors guard.py:575-644 enforce path (merge/restart/check/reset).
export const promotionRun = (bug?:string) => rule('promotion lifecycle')
  .inputs({...reqKinds,event:oneOf('admit','restart','finish','rollback'),resetOK:bool})
  .state({phase:oneOf('idle','merged','started','promoted','rollback-pending','rolled-back').from('idle'),
    candidateLive:bool.from(false),launchPassed:bool.from(false),checkFailed:bool.from(false)})
  .flags(e=>({admit:e.event.is('admit').and(e.phase.is('idle'),rolloutExpr({...e,check:yes},bug).eq(2)),
    finish:e.event.is('finish').and(e.phase.is('started')),
    back:e.event.is('rollback').and(e.phase.is('rollback-pending'))}))
  .step(e=>({
    phase:when(e.admit,'merged',when(e.event.is('restart').and(e.phase.is('merged')),'started',
      when(e.finish,when(rolloutExpr({...e,clean:yes,ff:yes,gated:no,receipt:no,call:no,idle:yes},bug).eq(2),e.phase.of('promoted'),e.phase.of('rollback-pending')),when(e.back,'rolled-back',e.phase)))),
    candidateLive:when(e.admit,yes,when(e.back.and(e.resetOK),no,e.candidateLive)),
    launchPassed:when(e.admit,no,when(e.finish,e.check,e.launchPassed)),
    checkFailed:when(e.finish,e.check.not(),e.checkFailed),
  }))

// ops.bend:320-340; ops.py:235-247; guard.py:882-897. Emissions != delivery receipts.
export const healthRun = (bug?:string) => rule('strike notification')
  .params({lim:nat}).inputs({ok:bool,now:nat,delivered:bool})
  .state({kind:oneOf(...nodeKinds).from('healthy'),since:0,emitted:0,deliveredCount:0,strikes:0})
  .flags(e=>({fire:nodeExpr(e,bug).emit.eq(1)}))
  .step(e=>({kind:new Choice(nodeExpr(e,bug).kind,nodeKinds),since:nodeExpr(e,bug).since,
    emitted:when(e.ok,0,e.emitted.plus(when(e.fire,1,0))),
    deliveredCount:when(e.ok,0,e.deliveredCount.plus(when(e.fire.and(e.delivered),1,0))),
    strikes:when(e.ok,0,e.strikes.plus(1))}))

// ops.bend:396-409; ops.py:259-275. Carries the gateway through arbitrary sequences.
export const restartRun = (bug?:string) => rule('restart resume')
  .params({gateway:nat}).inputs({ev:oneOf(...runEvents),x:nat,session:bool})
  .state({kind:oneOf(...runKinds).from('active'),gw:({gateway}:E)=>gateway,everInterrupted:bool.from(false)})
  .step(e=>({kind:new Choice(restartExpr(e,bug).kind,runKinds),gw:restartExpr(e,bug).gw,
    everInterrupted:e.everInterrupted.or(restartExpr(e,bug).kind.eq(1))}))

// Structural chart shadows, not replacements for the rules above. No side effects are modeled by charts.
export const healthChart = () => chart('health structure').states({healthy:{},bad:{},notified:{}})
  .on('bad',{from:'healthy',to:'bad'}).on('late',{from:'bad',to:'notified'})
  .on('recover',{from:['bad','notified'],to:'healthy'})
export const promotionChart = () => chart('promotion structure')
  .states({idle:{},merged:{},started:{},promoted:{final:true},rollbackPending:{},rolledBack:{final:true}})
  .on('admit',{from:'idle',to:'merged'}).on('restart',{from:'merged',to:'started'})
  .on('pass',{from:'started',to:'promoted'}).on('fail',{from:'started',to:'rollbackPending'})
  .on('rollback',{from:'rollbackPending',to:'rolledBack'})
export const restartChart = () => chart('restart structure')
  .states({active:{},interrupted:{},failed:{final:true},done:{final:true},resumed:{final:true},reported:{final:true}})
  .on('restart',{from:'active',to:'interrupted'}).on('error',{from:'active',to:'failed'})
  .on('done',{from:'active',to:'done'}).on('resume',{from:'interrupted',to:'resumed'})
  .on('report',{from:'interrupted',to:'reported'})
export const servedChart = () => chart('transaction structure').states({idle:{},held:{}})
  .on('begin',{from:'idle',to:'held'}).on('end',{from:'held',to:'idle'})
