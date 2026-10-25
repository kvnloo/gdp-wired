import {describe, expect, test} from 'bun:test'
import {bool, fun, nat, rule, when} from '../../core/dsl.ts'
import {decisionCase, machineCase} from '../../examples/harness.ts'
import {enableDecisionCapture} from './decisions.ts'
import {edits, machineEdits, mutateCase} from './mutate.ts'
enableDecisionCapture()

describe('rule implementation mutations', () => {
  test('deterministic edits and truncation; killed has concrete per-law witness', () => {
    const r = rule('cap').inputs({n: nat}).state({s: 0}).step(({n}) => ({s: when(n.atMost(3), n, 0)}))
    const c = machineCase('cap', '', r, [r.law('cap', ({s}) => s.atMost(3))])
    const a = mutateCase(c, {cap: 200, trials: 30, seed: 42}), b = mutateCase(c, {cap: 200, trials: 30, seed: 42})
    expect(a.summary).toEqual(b.summary)
    expect(a.rows.map(x => x.edit)).toEqual(b.rows.map(x => x.edit))
    expect(a.summary.killed).toBeGreaterThan(0)
    for (const row of a.rows.filter(x => x.status === 'killed')) expect(Object.values(row.laws).some(c => c.killed && c.witness && !c.proven)).toBe(true)
    const capped = mutateCase(c, {cap: 1, trials: 10})
    expect(capped.rows.length).toBe(1); expect(capped.truncated).toBe(true)
  })
  test('identity update is a surviving observationally different law gap', () => {
    const r = rule('increment').state({s: 0}).step(({s}) => ({s: s.plus(1)}))
    const c = machineCase('increment', '', r, [r.law('at most 100 or above 0', ({s}) => s.atMost(100).or(s.atLeast(0)))])
    const m = mutateCase(c, {trials: 10})
    const identity = m.rows.find(x => x.edit.operator === 'identity-update')!
    expect(identity.status).toBe('survived'); expect(identity.likely_equivalent).toBe(false)
  })
  test('drop conjunct and add/sub/min/max/not/branch edits are generated', () => {
    const r = rule('ops').inputs({x: nat, y: nat}).state({s: 0}).flags(({x,y}) => ({ok: x.lt(y).and(x.eq(0))})).assume(({x}) => x.atMost(5)).step(({x, s, ok}) => ({s: when(ok, s.plus(x), s.minus(x))}))
    const operators = machineEdits(r.machine).map(x => x.operator)
    for (const op of ['drop-conjunct:0', 'insert-not', 'swap-branches', 'arithmetic:add→sub', 'arithmetic:sub→add', 'identity-update']) expect(operators).toContain(op)
    expect(edits({op: 'min', a: {op:'const',value:1}, b: {op:'const',value:2}}).map(x=>x.operator)).toContain('extremum:min→max')
  })
})

test('decision law callback is unchanged even when output equals a literal or input in its spec', () => {
  const f = fun('zero').inputs({x: nat}).returns(() => ({out: 0}))
  const d = f.law('equals zero', () => [], o => o.out.eq(0))
  const c = decisionCase('zero', '', [d]), m = mutateCase(c, {trials: 20})
  const plus = m.rows.find(x => x.edit.operator === 'constant:+1')!
  expect(plus.status).toBe('killed'); expect(plus.laws['equals zero']!.witness).toBeDefined()
})

test('numeric computed decision output and boolean decision output retain specs', () => {
  const f = fun('add').inputs({x: nat}).returns(({x}) => ({out: x.plus(1)}))
  const m = mutateCase(decisionCase('add', '', [f.law('adds one', () => [], (o, {x}) => o.out.eq(x.plus(1)))]), {trials: 40})
  expect(m.summary.killed).toBeGreaterThan(0)
  const b = fun('bool').inputs({x: bool}).returns(({x}) => ({out: x}))
  const bm = mutateCase(decisionCase('bool', '', [b.law('same bool', () => [], (o, {x}) => o.out.implies(x).and(x.implies(o.out)))]), {trials: 20})
  expect(bm.summary.killed).toBeGreaterThan(0)
})

test('bare decide is explicitly unsupported, never mutates the specification', () => {
  const r = rule('direct').inputs({x: nat}), d = r.decide('identity', () => [], ({x}) => x.eq(x))
  const m = mutateCase(decisionCase('direct','',[d]))
  expect(m.supported).toBe(false); expect(m.summary.total).toBe(0)
})
