// Pinned z0 source f46ecbffda3f (all citations relative to that checkout).
// Pure finite contracts only: sensors/paths/timestamps are NOT silently proved.
import {bool, count, fun, nat, oneOf, rule, when, yes} from '../../core/dsl.ts'
import {chart} from '../../core/chart.ts'
export type Env = any
export const fields: Record<string, string[]> = {
  r1: ['target', 'before_metric', 'functional_probe', 'expiry_valid'],
  r2: ['same_metric', 'in_bounds_twice', 'separated_24h'],
  r3: ['probe_failed', 'owned', 'leased'],
  r4: ['same_window', 'share_at_least_30'],
  r7: ['report_only', 'same_finding', 'age_expired'],
}
export const evidence = oneOf('absent', 'false', 'true')
export const known = (e: Env) => e.is('absent').not()
export const affirmed = (e: Env) => e.is('true')
export const every = (xs: any[]) => yes.and(...xs)
// Verdict tags: 0 unknown, 1 pass, 2 violation. Evidence is an exact 3-way sum,
// not truthiness: invalid Python values map to absent in the explicit adapter.
// bend/root_cause_fsm/root.bend:15-88; src/z0int/fsm/root_cause.py:18-41;
// src/z0int/fsm/root_canaries.py:21-22 (R7 only has a Boolean Python domain).
export function rootTerm(id: string, bug = '') {
  return (e: Env) => {
    if (bug === 'bad verdict') return 3
    const fs = fields[id]!
    const complete = every(fs.map(f => bug === `known bypass ${f}` ? yes : known(e[f])))
    const holds = every(fs.map(f => bug === `affirmed bypass ${f}` ? yes : affirmed(e[f])))
    return bug === 'always SUnknown{}' ? 0 : bug === 'always SViolation{}' ? 2 : when(complete, when(holds, 1, 2), 0)
  }
}
export const root = (id: string, bug = '') => fun(id).inputs(Object.fromEntries(fields[id]!.map(f => [f, evidence])))
  .returns((e: Env) => ({out: rootTerm(id, bug)(e)}))
// Full-result adapter: passed probe is negated into probe_failed, NOT the gate's
// 'pass' verdict. bend/root_cause_fsm/root.bend:91-105; root_cause.py:32-36.
export const finishTerm = (e: Env, bug = '') => bug === 'rollback without gate' ? 3
  : when(e.v.is('unknown'), 0, when(e.v.is('pass'), bug === 'drop rollback' ? 0 : 3, when(e.failed, 0, 1)))
export const finish = (bug = '') => fun('r3_finish').inputs({v: oneOf('unknown', 'pass', 'violation'), failed: bool})
  .returns((e: Env) => ({out: finishTerm(e, bug)}))
export const r3Result = () => fun('r3_result').inputs(Object.fromEntries(fields.r3!.map(f => [f, evidence])))
  .returns((e: Env) => {
    const v = rootTerm('r3')(e)
    return {out: when(v.eq(0), 0, when(v.eq(1), 3, when(affirmed(e.probe_failed), 0, 1)))}
  })
// bend/artifact_lease_fsm/lease.bend:5-6; artifact_leases.py:16-20.
export const leaseFields = ['expired', 'allowlisted', 'known_nonlive', 'no_symlink', 'archive_ready']
export const leaseMutants = ['unexpired', 'outside_allowlist', 'LIVE', 'symlink', 'unarchived_worktree']
export const leaseTerm = (e: Env, bug = '') => count(every(leaseFields.map((f, i) => bug === leaseMutants[i] ? yes : e[f])))
export const lease = (bug = '') => fun('eligible').inputs(Object.fromEntries(leaseFields.map(f => [f, bool])))
  .returns((e: Env) => ({out: bug === 'always false' ? 0 : leaseTerm(e, bug)}))
// Explicit Python-facing unknown guard, separate from the five Bool Bend inputs.
export const leaseEvidence = () => fun('lease evaluate').inputs(Object.fromEntries(leaseFields.map(f => [f, evidence])))
  .returns((e: Env) => ({out: when(every(leaseFields.map(f => known(e[f]))), when(every(leaseFields.map(f => affirmed(e[f]))), 1, 2), 0)}))
// bend/placement_fsm/placement.bend:9-22; cgroup_placement.py:14-18.
export const placementTerm = (e: Env, bug = '') => when(e.available,
  when(e.agent, when(e.scoped, bug === 'scoped_violation' ? 2 : 1, bug === 'unscoped_pass' ? 1 : 2), bug === 'non_agent_violation' ? 2 : 1),
  bug === 'unavailable_pass' ? 1 : 0)
export const placement = (bug = '') => fun('h').inputs({available: bool, agent: bool, scoped: bool})
  .returns((e: Env) => ({out: placementTerm(e, bug)}))
export const placementEvidence = () => fun('placement typed adapter').inputs({available: evidence, agent: evidence, scoped: evidence})
  .returns((e: Env) => ({out: when(every(['available', 'agent', 'scoped'].map(f => known(e[f]))), placementTerm({available: affirmed(e.available), agent: affirmed(e.agent), scoped: affirmed(e.scoped)}), 0)}))
// Stateless decisions lifted to observation streams solely to exercise from:any.
// Every observation overwrites the output; arbitrary previous status is irrelevant.
export const observe = (id: string, bug = '') => rule(`observe ${id}`).inputs(Object.fromEntries(fields[id]!.map(f => [f, evidence])))
  .state({out: 0}).step((e: Env) => ({out: bug === 'retain previous pass' ? when(e.out.eq(1), 1, rootTerm(id)(e)) : rootTerm(id)(e)}))
// Run-level extension of artifact_leases.py:64-73. Snapshot identity, sources,
// containment etc. stay explicit bits. No deletion is modeled or authorized.
export const leaseObservation = (bug = '') => rule('lease observation stream')
  .params({created: nat, ttl: nat})
  .inputs({now: nat, allowlisted: bool, known_nonlive: bool, no_symlink: bool, archive_ready: bool})
  .state({eligible: 0})
  .step((e: Env) => {
    const fresh = leaseTerm({...e, expired: bug === 'ignore expiry' ? yes : e.now.atLeast(e.created.plus(e.ttl))})
    return {eligible: bug === 'cache previous pass' ? when(e.eligible.eq(1), 1, fresh) : fresh}
  })
// This chart describes recomputing a report, not a cleanup actor or lifecycle.
// Terminal/stuck cleanup claims would invent semantics absent from the source.
export function placementChart() {
  let c = chart('placement observations').inputs({available: bool, agent: bool, scoped: bool})
    .states({unknown: {}, pass: {}, violation: {}}).events('observe')
  c = c.on('observe', {from: ['unknown', 'pass', 'violation'], to: 'unknown', when: (e: Env) => e.available.not()})
    .on('observe', {from: ['unknown', 'pass', 'violation'], to: 'pass', when: (e: Env) => e.available.and(e.agent.not().or(e.scoped))})
    .on('observe', {from: ['unknown', 'pass', 'violation'], to: 'violation', when: (e: Env) => e.available.and(e.agent, e.scoped.not())})
  return c
}
export const rootMutants = Object.entries(fields).flatMap(([id, fs]) => [
  ...fs.flatMap(f => ['affirmed', 'known'].map(k => ({id, bug: `${k} bypass ${f}`}))),
  ...['SUnknown{}', 'SViolation{}'].map(v => ({id, bug: `always ${v}`})),
])
