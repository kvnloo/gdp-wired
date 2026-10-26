// Pinned z0 source: sqlite-store-laws@d2e34614638059b38da77fd5f0bb582af500a503.
// Bend ops.bend:497-507; twin src/z0int/fsm/ops.py:401-415. Exact Bool/Nat tables.
import {bool, count, fun, nat, no, oneOf, rule, when, yes} from '../../core/dsl.ts'
export const PIN = 'd2e34614638059b38da77fd5f0bb582af500a503'
type E = any
export const MUTANTS = ['ignore holders', 'ignore scan completeness', 'ignore ghosts', 'lose credentials',
  'unknown baseline earns credit', 'stale inode removes sidecars', 'always refuse replacement',
  'always refuse health', 'always refuse auth', 'always refuse sidecars', 'unknown scan declared healthy'] as const
export const AUTH_GAP_MUTANTS = ['auth equality only', 'auth n9 only'] as const
export type Bug = typeof MUTANTS[number] | typeof AUTH_GAP_MUTANTS[number] | undefined
export const replaceCond = (complete: E, empty: E, bug?: Bug) => bug === 'ignore holders' ? complete : bug === 'ignore scan completeness' ? empty : bug === 'always refuse replacement' ? no : complete.and(empty)
export const holdersCond = (complete: E, ghosts: E, bug?: Bug) => bug === 'ignore ghosts' ? complete : bug === 'unknown scan declared healthy' ? ghosts.not() : bug === 'always refuse health' ? no : complete.and(ghosts.not())
export const authCond = (known: E, before: E, after: E, bug?: Bug) => bug === 'lose credentials' ? known : bug === 'unknown baseline earns credit' ? before.atMost(after) : bug === 'always refuse auth' ? no : bug === 'auth equality only' ? known.and(before.eq(after)) : bug === 'auth n9 only' ? known.and(before.eq(9),after.eq(9)) : known.and(before.atMost(after))
export const sidecarCond = (current: E, bug?: Bug) => bug === 'stale inode removes sidecars' ? yes : bug === 'always refuse sidecars' ? no : current
export const replace = (bug?: Bug) => fun('sqlite_replace_allows').inputs({complete: bool, empty: bool}).returns(({complete, empty}) => ({ok: count(replaceCond(complete, empty, bug))}))
export const holders = (bug?: Bug) => fun('sqlite_holders_ok').inputs({complete: bool, ghosts: bool}).returns(({complete, ghosts}) => ({ok: count(holdersCond(complete, ghosts, bug))}))
export const auth = (bug?: Bug) => fun('sqlite_auth_ok').inputs({known: bool, before: nat, after: nat}).returns(({known, before, after}) => ({ok: count(authCond(known, before, after, bug))}))
export const sidecar = (bug?: Bug) => fun('sqlite_sidecar_allows').inputs({current: bool}).returns(({current}) => ({ok: count(sidecarCond(current, bug))}))

// sqlite_guard.py:139-168: abstract only the holder-list computations; these are
// independently exercised against the actual Python function by parity.ts.
export const OPS = ['inspect', 'replace', 'unlink', 'recreate', 'remove-sidecars', 'other'] as const
export const receipt = (bug?: 'authorizes') => fun('sqlite_decision').inputs({
  complete: bool, empty: bool, ghosts: bool, known: bool, before: nat, after: nat,
  actorKnown: bool, actorMain: bool, actorGhost: bool, op: oneOf(...OPS),
}).returns((e: E) => {
  const replacement = replaceCond(e.complete, e.empty), healthy = holdersCond(e.complete, e.ghosts)
  const preserved = authCond(e.known, e.before, e.after)
  const current = e.actorKnown.and(e.actorMain, e.actorGhost.not())
  const mutating = e.op.is('replace').or(e.op.is('unlink'), e.op.is('recreate'))
  return {replacement: count(replacement), holder_health: count(healthy), auth_preserved: count(preserved),
    sidecar_actor_current: count(current), authorization: bug ? 1 : 0,
    ghostViolation: count(e.ghosts), authViolation: count(e.known.and(e.before.gt(e.after))),
    holdersViolation: count(mutating.and(replacement.not(), e.empty.not())),
    incompleteViolation: count(mutating.and(replacement.not(), e.empty)),
    unknownAuthViolation: count(e.op.is('recreate').and(e.known.not())),
    sidecarViolation: count(e.op.is('remove-sidecars').and(current.not()))}
})
export type Holder = {pid: number, path: string, ghost: boolean}
export type Observation = {complete: boolean, holders: Holder[], before: number | null, after: number | null, operation?: string, actor_pid?: number | null, db: string}
const unique = (xs: number[]) => [...new Set(xs)].sort((a,b) => a-b)
const receiptPort = receipt()
export function decide(x: Observation, sabotage = false) {
  const hs = x.holders, ghosts = hs.filter(h => h.ghost), actor = x.actor_pid ?? null
  const o = receiptPort.run({complete: x.complete, empty: !hs.length, ghosts: !!ghosts.length,
    known: x.before !== null && x.after !== null, before: x.before ?? 0, after: x.after ?? 0,
    actorKnown: actor !== null, actorMain: hs.some(h => h.pid === actor && h.path === x.db && !h.ghost),
    actorGhost: ghosts.some(h => h.pid === actor),
    op: OPS.includes((x.operation ?? 'inspect') as any) ? x.operation ?? 'inspect' : 'other'} as any) as Record<string, number>
  const pids = unique(hs.map(h => h.pid)), ghost_pids = unique(ghosts.map(h => h.pid)), violations: any[] = []
  if (o.ghostViolation) violations.push({law: 'o16_sqlite_no_ghost_holders', pids: ghost_pids})
  if (o.authViolation) violations.push({law: 'o16_sqlite_auth_non_decreasing', before: x.before, after: x.after})
  if (o.holdersViolation) violations.push({law: 'o16_sqlite_replace_no_holders', pids})
  if (o.incompleteViolation) violations.push({law: 'o16_sqlite_replace_scan_complete', pids})
  if (o.unknownAuthViolation) violations.push({law: 'o16_sqlite_auth_known', pids: []})
  if (o.sidecarViolation) violations.push({law: 'o16_sqlite_sidecar_current_inode', pids: actor ? [actor] : []})
  return {violations, pids, ghost_pids, requirements_met: {replacement: !!o.replacement,
    holder_health: !!o.holder_health, auth_preserved: !!o.auth_preserved, sidecar_actor_current: !!o.sidecar_actor_current}, authorization: sabotage || !!o.authorization}
}

// An EXPLICIT counterfactual caller, NOT production enforcement. Production is
// read-only (sqlite_guard.py:168,199-206); it does not replace any store.
// docs/fsm/sqlite-store-root-cause.md:55-71 and the lifecycle procedure describe
// these opens/closes and split-generation risks. Counts aggregate arbitrary DB,
// WAL, SHM holders. visible/hidden distinguish observable FDs from out-of-scope
// holders (namespace/mmap); ghost counts retain references to older generations.
// Main/WAL/SHM ids are monotone generation names, NOT Linux inode numbers (reuse).
// snapshot mode consumes cached requirements without common exclusion. atomic
// mode is a proposed sufficient protocol, assumes every opener shares one step.
export type LifeBug = 'partial licenses' | 'auth rollback' | 'no epoch advance' | 'stale sidecar' | 'ignore actual holders' | 'forget ghost holders' | 'skip auth check'
export const EVENTS = ['open', 'close', 'open-hidden', 'close-hidden', 'close-ghost', 'close-hidden-ghost', 'scan', 'replace', 'recreate', 'remove-sidecars', 'auth-write'] as const
export function lifecycle(mode: 'snapshot' | 'atomic' = 'snapshot', bug?: LifeBug) {
  return rule(`SQLite lifecycle (${mode})`).params({initialAuth: nat})
    .inputs({op: oneOf(...EVENTS), complete: bool, known: bool, amount: nat, actorEpoch: nat, actorHasMain: bool})
    .state({main: 1, wal: 1, shm: 1, visible: 0, hidden: 0, ghosts: 0, hiddenGhosts: 0,
      scanComplete: bool.from(false), scanEmpty: bool.from(false), scanEpoch: 0, scanAuthEpoch: 0,
      auth: ({initialAuth}) => initialAuth, authEpoch: 0, authKnown: bool.from(false), scannedAuth: 0,
      replacements: 0, removed: 0})
    .flags((e: E) => ({
      swapping: e.op.is('replace').or(e.op.is('recreate')),
      censusOK: replaceCond(bug === 'partial licenses' ? yes : e.scanComplete, e.scanEmpty),
      actualEmpty: e.visible.plus(e.hidden).plus(e.ghosts).plus(e.hiddenGhosts).eq(0),
    }))
    .flags((e: E) => ({
      installing: e.swapping.and(e.censusOK, mode === 'atomic' ?
        (bug === 'ignore actual holders' ? yes : e.actualEmpty).and(e.scanEpoch.eq(e.main), e.scanAuthEpoch.eq(e.authEpoch),
          bug === 'skip auth check' ? yes : authCond(e.authKnown, e.auth, e.amount)) : authCond(e.authKnown, e.scannedAuth, e.amount)),
      removing: e.op.is('remove-sidecars').and(bug === 'stale sidecar' ? yes : e.actorHasMain.and(e.actorEpoch.eq(e.main))),
    }))
    .step(e => {
      const nextAuth = bug === 'auth rollback' ? 0 : e.amount
      const writeAuth = e.installing.or(e.op.is('auth-write').and(e.known, mode === 'atomic' ? e.amount.atLeast(e.auth) : yes))
      return {
        main: when(e.installing, bug === 'no epoch advance' ? e.main : e.main.plus(1), e.main),
        wal: when(e.installing, e.main.plus(1), when(e.removing, 0, e.wal)),
        shm: when(e.installing, e.main.plus(1), when(e.removing, 0, e.shm)),
        visible: when(e.installing, 0, when(e.op.is('open'), e.visible.plus(1), when(e.op.is('close'), e.visible.minus(1), e.visible))),
        hidden: when(e.installing, 0, when(e.op.is('open-hidden'), e.hidden.plus(1), when(e.op.is('close-hidden'), e.hidden.minus(1), e.hidden))),
        ghosts: when(e.installing, bug === 'forget ghost holders' ? 0 : e.ghosts.plus(e.visible), when(e.op.is('close-ghost'), e.ghosts.minus(1), e.ghosts)),
        hiddenGhosts: when(e.installing, e.hiddenGhosts.plus(e.hidden), when(e.op.is('close-hidden-ghost'), e.hiddenGhosts.minus(1), e.hiddenGhosts)),
        scanComplete: when(e.op.is('scan'), e.complete, e.scanComplete),
        scanEmpty: when(e.op.is('scan'), e.visible.plus(e.ghosts).eq(0), e.scanEmpty),
        scanEpoch: when(e.op.is('scan'), e.main, e.scanEpoch),
        scanAuthEpoch: when(e.op.is('scan'), e.authEpoch, e.scanAuthEpoch),
        auth: when(writeAuth, nextAuth, e.auth),
        authEpoch: when(writeAuth, e.authEpoch.plus(1), e.authEpoch),
        authKnown: when(e.op.is('scan'), e.known, e.authKnown),
        scannedAuth: when(e.op.is('scan'), e.auth, e.scannedAuth),
        replacements: when(e.installing, e.replacements.plus(1), e.replacements),
        removed: when(e.removing, e.removed.plus(1), e.removed),
      }
    })
}
