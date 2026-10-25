// Capture the public Fun.law/relate callbacks, not private builder fields. Re-run the SAME
// specification over a changed return expression; structural replacement in an inlined
// goal would also change equal constants/inputs in the specification and is unsound.
import {Cond, Fun, Term, type Decision, funOf} from '../../core/dsl.ts'
import type {Machine} from '../../core/machine.ts'
import {substE} from '../../kernel/kernel.ts'

type AnyFun = NonNullable<ReturnType<typeof funOf>>
type Output = (env: object) => Record<string, unknown>
type Spec = {kind: 'law' | 'relate', args: unknown[], output: Output, fun: AnyFun}
const outputs = new WeakMap<object, Output>(), specs = new WeakMap<Decision, Spec>()
let enabled = false

export function enableDecisionCapture(): void {
  if (enabled) return
  enabled = true
  const returns = Fun.prototype.returns, law = Fun.prototype.law, relate = Fun.prototype.relate
  Object.defineProperty(Fun.prototype, 'returns', {configurable: true, writable: true, value: function (this: AnyFun, ...args: Parameters<typeof returns>) {
    const f = Reflect.apply(returns, this, args)
    outputs.set(f, args[0] as Output)
    return f
  }})
  for (const kind of ['law', 'relate'] as const) {
    const method = kind === 'law' ? law : relate
    // Public prototype boundary: the callbacks are retained without interpreting their types.
    Object.defineProperty(Fun.prototype, kind, {configurable: true, writable: true, value: function (this: AnyFun, ...args: unknown[]) {
      const d: Decision = Reflect.apply(method, this, args), output = outputs.get(this)
      if (output) specs.set(d, {kind, args, output, fun: this})
      return d
    }})
  }
}

export function decisionMutation(d: Decision, machine: Machine, path: (string | number)[]): Decision {
  const spec = specs.get(d)
  if (!spec) throw new Error('unsupported decision: no captured public Fun callbacks (bare decide or prebuilt function)')
  if (path[0] !== 'step' || path[1] !== 'state' || typeof path[2] !== 'string') throw new Error('unsupported decision assumption/flag edit')
  const name = path[2], key = name.slice('out.'.length), raw = machine.step.state?.[name]
  if (!name.startsWith('out.') || key.includes('.') || !raw) throw new Error('unsupported structured output')
  // Fun's observable return is one step from init; identity means its initial output, not a free law variable.
  const e = substE(raw, {vars: machine.state, maps: {}, flags: {}})
  const f = spec.fun.returns((env: object) => {
    const out = spec.output(env), value = out[key]
    if (value instanceof Cond) {
      if (e.op === 'const' && (e.value === 0 || e.value === 1)) return {...out, [key]: new Cond({op: e.value ? 'and' : 'or', xs: []})} as never
      if (e.op !== 'if' || e.then.op !== 'const' || e.else.op !== 'const' || ![0,1].includes(e.then.value) || ![0,1].includes(e.else.value)) throw new Error('mutation leaves boolean output encoding')
      const condition = e.then.value === e.else.value ? {op: e.then.value ? 'and' as const : 'or' as const, xs: []} : e.then.value ? e.c : {op: 'not' as const, x: e.c}
      return {...out, [key]: new Cond(condition)} as never
    }
    if (!(value instanceof Term) && typeof value !== 'number') throw new Error('unsupported non-scalar return kind')
    return {...out, [key]: new Term(e)} as never
  })
  return Reflect.apply(spec.kind === 'law' ? f.law : f.relate, f, spec.args)
}
