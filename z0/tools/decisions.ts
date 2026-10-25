// Capture the public Fun.law/relate callbacks, not private builder fields. Re-run the SAME
// specification over a changed return expression; structural replacement in an inlined
// goal would also change equal constants/inputs in the specification and is unsound.
import {Cond, Fun, Term, type Decision, funOf} from '../../core/dsl.ts'
import type {E, Machine} from '../../core/machine.ts'

type AnyFun = NonNullable<ReturnType<typeof funOf>>
type Output = (env: never) => Record<string, unknown>
type Spec = {kind: 'law' | 'relate', args: unknown[], output: Output, fun: AnyFun}
const outputs = new WeakMap<object, Output>(), specs = new WeakMap<Decision, Spec>()
let enabled = false

export function enableDecisionCapture(): void {
  if (enabled) return
  enabled = true
  const returns = Fun.prototype.returns, law = Fun.prototype.law, relate = Fun.prototype.relate
  Fun.prototype.returns = function (...args: Parameters<typeof returns>) {
    const f = Reflect.apply(returns, this, args)
    outputs.set(f, args[0] as Output)
    return f
  }
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
  const name = path[2], key = name.slice('out.'.length), e = machine.step.state?.[name]
  if (!name.startsWith('out.') || key.includes('.') || !e) throw new Error('unsupported structured output')
  const f = spec.fun.returns((env: never) => {
    const out = spec.output(env), value = out[key]
    if (value instanceof Cond) {
      if (e.op !== 'if' || e.then.op !== 'const' || e.then.value !== 1 || e.else.op !== 'const' || e.else.value !== 0) throw new Error('mutation leaves boolean output encoding')
      return {...out, [key]: new Cond(e.c)} as never
    }
    if (!(value instanceof Term) && typeof value !== 'number') throw new Error('unsupported non-scalar return kind')
    return {...out, [key]: new Term(e)} as never
  })
  return Reflect.apply(spec.kind === 'law' ? f.law : f.relate, f, spec.args)
}
