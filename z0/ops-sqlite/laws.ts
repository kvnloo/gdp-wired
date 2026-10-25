import {count} from '../../core/dsl.ts'
import {decisionCase, machineCase} from '../../examples/harness.ts'
import type {Entry} from '../entry.ts'
import * as P from './port.ts'
export type {Entry} from '../entry.ts'
type E = any
const source = 'sqlite-store-laws@' + P.PIN + '/'
export const decisionWithBug: Record<string, (bug?: P.Bug) => any> = {}
function D(n: number, id: string, line: number, mk: any, given: any, then: any, bug: any, says = id): Entry {
  const name = id
  decisionWithBug[id] = (b?:P.Bug) => mk(b).law(name,given,then)
  return {n, law_id: id, src: source + 'bend/ops_fsm/LAWS.bend:' + line, bend: id, says,
    fns: 'ops.bend:497-507; src/z0int/fsm/ops.py:401-415', kind: 'decide', encoding: 'exact',
    case: () => decisionCase(name, says, [mk().law(name, given, then)], [{name: bug, why: says, decision: mk(bug).law(name, given, then)}], {bound:n===9?12:4})}
}
export const bendLaws: Entry[] = [
  D(1, 'o16_sqlite_replace_no_holders', 491, P.replace, (e:E,o:E) => o.ok.eq(1), (_o:E,e:E) => e.empty, P.MUTANTS[0]),
  D(2, 'o16_sqlite_replace_scan_complete', 497, P.replace, (e:E,o:E) => o.ok.eq(1), (_o:E,e:E) => e.complete, P.MUTANTS[1]),
  D(3, 'o16_sqlite_no_ghost_holders', 503, P.holders, (e:E,o:E) => o.ok.eq(1), (_o:E,e:E) => e.ghosts.not(), P.MUTANTS[2]),
  D(4, 'o16_sqlite_auth_non_decreasing', 509, P.auth, (e:E,o:E) => o.ok.eq(1), (_o:E,e:E) => e.before.atMost(e.after), P.MUTANTS[3]),
  D(5, 'o16_sqlite_auth_known', 516, P.auth, (e:E,o:E) => o.ok.eq(1), (_o:E,e:E) => e.known, P.MUTANTS[4]),
  D(6, 'o16_sqlite_sidecar_current_inode', 523, P.sidecar, (e:E,o:E) => o.ok.eq(1), (_o:E,e:E) => e.current, P.MUTANTS[5]),
  D(7, 'o16_sqlite_quiescent_replace', 528, P.replace, (e:E) => [e.complete,e.empty], (o:E) => o.ok.eq(1), P.MUTANTS[6]),
  D(8, 'o16_sqlite_healthy_holders', 531, P.holders, (e:E) => [e.complete,e.ghosts.not()], (o:E) => o.ok.eq(1), P.MUTANTS[7]),
  D(9, 'o16_sqlite_auth_retained', 534, P.auth, (e:E) => [e.known,e.before.eq(9),e.after.eq(9)], (o:E) => o.ok.eq(1), P.MUTANTS[8]),
  D(10, 'o16_sqlite_current_sidecar', 537, P.sidecar, (e:E) => e.current, (o:E) => o.ok.eq(1), P.MUTANTS[9]),
  D(11, 'o16_sqlite_unknown_holders', 540, P.holders, (e:E) => e.complete.not(), (o:E) => o.ok.eq(0), P.MUTANTS[10]),
]
export const total = (e:E) => e.visible.plus(e.hidden).plus(e.ghosts).plus(e.hiddenGhosts)
export const lifeSteps = {
  partial: (r:E) => r.stepLaw('partial snapshot never licenses install', (e:E,a:E) => a.replacements.eq(e.replacements), (e:E) => e.scanComplete.not()),
  empty: (r:E) => r.stepLaw('atomic install has no seen or unseen old-inode holder', (e:E,a:E) => a.replacements.gt(e.replacements).implies(total(e).eq(0))),
  auth: (r:E) => r.stepLaw('auth count never rolls back across a step', (e:E,a:E) => a.auth.atLeast(e.auth)),
  known: (r:E) => r.stepLaw('atomic install requires known auth', (e:E,a:E) => a.replacements.gt(e.replacements).implies(e.authKnown)),
  epoch: (r:E) => r.stepLaw('every install advances main generation', (e:E,a:E) => a.replacements.gt(e.replacements).implies(a.main.eq(e.main.plus(1)))),
  sidecars: (r:E) => r.stepLaw('install puts DB WAL SHM in the same generation', (e:E,a:E) => a.replacements.gt(e.replacements).implies(a.wal.eq(a.main).and(a.shm.eq(a.main)))),
  actor: (r:E) => r.stepLaw('old-inode actor never removes current sidecars', (e:E,a:E) => a.removed.gt(e.removed).implies(e.actorHasMain.and(e.actorEpoch.eq(e.main)))),
  refs: (r:E) => r.stepLaw('install preserves every existing inode reference', (e:E,a:E) => a.replacements.gt(e.replacements).implies(total(a).eq(total(e)))),
  kAuth: (r:E) => r.stepsLaw('auth never rolls back across four arbitrary events', 4, (e:E,a:E) => a.auth.atLeast(e.auth)),
  fresh: (r:E) => r.stepLaw('install uses the current auth epoch', (e:E,a:E) => a.replacements.gt(e.replacements).implies(e.scanAuthEpoch.eq(e.authEpoch))),
}
function M(id: string, mode:'snapshot'|'atomic', step: keyof typeof lifeSteps, bug: P.LifeBug): Entry {
  return {n:0, law_id:id, bend:id, src:source+'docs/fsm/sqlite-store-root-cause.md:55-71',
    says: `${mode}: ${step}; hypothetical caller only, NOT deployed enforcement`, fns:'lifecycle', kind: step==='kAuth' ? 'k-step law':'step law', encoding:'abstracted',
    case:() => {const r=P.lifecycle(mode), b=P.lifecycle(mode,bug); return machineCase(id,id,r,[],[{name:bug,why:id,rule:b,laws:[],steps:[lifeSteps[step](b)]}],{steps:[lifeSteps[step](r)],bound:3,depth:16})}}
}
export const extras: Entry[] = [
  D(0,'auth_retained_general_n',534,P.auth,(e:E)=>[e.known,e.before.eq(e.after)],(o:E)=>o.ok.eq(1),'always refuse auth','Generalize 9 to every natural credential count'),
  D(0,'auth_increase_accepted',534,P.auth,(e:E)=>[e.known,e.before.atMost(e.after)],(o:E)=>o.ok.eq(1),'always refuse auth','All known nondecreasing counts, not only equal counts'),
  D(0,'holder_health_requires_complete',503,P.holders,(e:E,o:E)=>o.ok.eq(1),(_o:E,e:E)=>e.complete,'unknown scan declared healthy','Completeness necessity absent from the named ghost law'),
  {n:0,law_id:'receipt_never_authorizes',bend:'receipt_never_authorizes',src:source+'src/z0int/fsm/sqlite_guard.py:168',says:'requirements are not authority',fns:'sqlite_decision',kind:'decide',encoding:'abstracted',
    case:()=>decisionCase('receipt_never_authorizes','read only',[P.receipt().law('receipt_never_authorizes',()=>[],(o:E)=>o.authorization.eq(0))],[{name:'authorizes',why:'evidence is not authority',decision:P.receipt('authorizes').law('receipt_never_authorizes',()=>[],(o:E)=>o.authorization.eq(0))}])},
  M('partial_scan_over_runs','snapshot','partial','partial licenses'),
  M('atomic_no_old_inode_holders','atomic','empty','ignore actual holders'),
  M('atomic_auth_non_decreasing','atomic','auth','auth rollback'),
  M('atomic_auth_known','atomic','known','skip auth check'),
  M('replace_advances_generation','snapshot','epoch','no epoch advance'),
  M('replace_sidecar_generation','snapshot','sidecars','no epoch advance'),
  M('sidecar_actor_generation','snapshot','actor','stale sidecar'),
  M('old_inode_references_retained','snapshot','refs','forget ghost holders'),
  M('atomic_auth_four_events','atomic','kAuth','auth rollback'),
]
// Freshness is probed separately: snapshot is expected to refute it. The atomic
// epoch guard is reviewed directly; no artificial bug weakens a Bend law.
export const strongProbes = [
  {id:'snapshot_no_actual_holders',step:lifeSteps.empty},
  {id:'snapshot_auth_monotonic',step:lifeSteps.auth},
  {id:'snapshot_auth_epoch_fresh',step:lifeSteps.fresh},
]
