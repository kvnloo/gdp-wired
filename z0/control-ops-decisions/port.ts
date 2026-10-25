// Pinned source root: /mnt/zer0models/z0-wt/sqlite-store-laws @ d2e346146380.
// Bug numbers are 1-based entries of bend/ops_fsm/mutations.py (mutants.json).
import {bool, count, everyKey, fun, nat, oneOf, rule, when, yes} from '../../core/dsl.ts'
export const CLASSES = ['test','mutation','typecheck','gradle','bundle','eval','screenshot-run','gpu','bend','lean','service','agent-process','tiny'] as const
export const LANES = ['groot','mbp','phone'] as const
export const STAGES = ['none','shadow','canary','live'] as const
const bit = count
export const bitTerm = count
export const readyPlace = (ready:any) => when(ready,3,0)
const choose = (c:any,a:any,b:any) => c.and(a).or(c.not().and(b))
const groot = (c: any, bug = 0) => bug === 2 ? yes : c.is('gpu').or(c.is('bend'),c.is('lean'),c.is('service'),c.is('agent-process'),c.is('tiny'))
// ops.bend:49-109; ops.py:52-68. Place: wait=0,groot=1,mbp=2,phone=3.
export const placement = (bug = 0) => fun('O1 placement').inputs({cls:oneOf(...CLASSES),lane:oneOf(...LANES),m:bool,p:bool}).returns(({cls,lane,m,p}:any) => ({
  admits:bit(lane.is('groot').not().or(bug===1 ? yes : groot(cls,bug))),
  place:when(bug===5 ? yes : groot(cls,bug),1,when(m,bug===6?0:2,when(p,3,bug===3?1:bug===4?3:0))),
}))
// ops.bend:231-236; ops.py:177-178.
export const privacy = (bug = 0) => fun('O4 privacy').inputs({private:bool,vis:oneOf('public','private','unknown')}).returns((e:any)=>({ok:bit(choose(e.private,bug===22||bug===23?yes:e.vis.is('private'),bug===24?yes.not():yes))}))
// ops.bend:248-255; ops.py:190-194. Unused variant payloads do not affect the answer.
export const phone = (bug = 0) => fun('O5 phone').inputs({kind:oneOf('tap','install','restart'),intent:bool,fg:bool,chain:bool,call:bool}).returns(({kind,intent,fg,chain,call}:any)=>({ok:bit(when(kind.is('tap'),bug===25?fg:bug===26?intent:bug===106?intent.and(fg,call.not()):intent.and(fg),when(kind.is('install').and(bug===27?yes:yes.not()).or(kind.is('restart').and(bug===28?yes:yes.not())),yes,chain.and(call).not())))}))
// ops.bend:261-273; ops.py:200-206. Membership quotient of lists: duplicate/order irrelevant
// to a11y_ok and its elementwise law. first is list head when nonempty, for mutant 30 only.
// Mutant 29 recursively drops every head, hence always true, as does mutant 31.
export const a11yAccepted = ({Pre,Post,Rm,first}:any,bug=0) => bug===29||bug===31?yes:bug===30?Pre.has(first).implies(Post.has(first).or(Rm.has(first))):everyKey(k=>Pre.has(k).implies(Post.has(k).or(Rm.has(k))))
export const accessibility = (bug = 0) => rule('O6 accessibility').inputs({x:nat,first:nat}).carries('Pre','Post','Rm').state({ok:0})
  .assume((e:any)=>everyKey(k=>e.Pre.has(k).implies(e.Pre.has(e.first))))
  .flags((e:any)=>({accepted:a11yAccepted(e,bug)}))
  .step(({accepted}:any)=>({ok:bit(accepted)}))
// ops.bend:279-280; ops.py:216-217.
export const routing = (bug = 0) => fun('O7 routing').inputs({cancelled:bool,sol:bool,design:bool}).returns(({cancelled,sol,design}:any)=>({ok:bit((bug===32?yes:cancelled.not()).and(bug===33?yes:design.and(sol).not()))}))
// ops.bend:422-426; ops.py:71-77. Resource gates affect admission and thus placement;
// mutant 46 affects placement only.
export const resources = (bug = 0) => fun('O10 resources').inputs({ready:bool,memory:bool,cpu:bool,battery:bool,thermal:bool}).returns((e:any)=>{
  const gate = ({42:'memory',43:'cpu',44:'battery',45:'thermal'} as any)[bug]
  const admitted = gate?e.ready.and(e[gate]):e.ready
  return {ok:bit(admitted),place:when(bug===46?e.ready.and(e.memory):admitted,3,0)}
})
// ops.bend:441-467; Python has no scalar policy_allows twin: policy_guard.py:445-495
// audits richer receipts. Its stage/family/arm projection is compared separately, not invented as ops.py.
export const policy = (bug = 0) => fun('O11/O12 policy').inputs({family:nat,named_family:nat,stage:oneOf(...STAGES),named_arm:nat,arm:nat,offload:bool,healthy:bool,abstain:bool}).returns((e:any)=>{
  const credited = e.stage.is('canary').or(e.stage.is('live'),bug===47?e.stage.is('none'):yes.not(),bug===48?e.stage.is('shadow'):yes.not())
  const local = (bug===49?yes:e.family.eq(e.named_family)).and(bug===51?yes:credited,bug===50?yes:e.arm.eq(e.named_arm))
  const fallback = bug===52?yes:bug===53?e.healthy.or(e.abstain):bug===54?e.healthy.not():e.healthy.not().or(e.abstain)
  return {credited:bit(credited),ok:bit(when(e.offload,bug===55?yes:bug===101?yes.not():bug===107?local.and(e.healthy):local,e.family.ne(e.named_family).or(e.stage.is('live').not(),bug===102?yes.not():fallback)))}
})
// ops.bend:473-491; ops.py:279-296. Scope ids are natural names; injective physical
// identity interning, valid unexpired credit, and nonnegative counts are caller obligations.
export const capacity = (bug = 0) => fun('O13 capacity').inputs({credited:bool,actual:nat,named:nat,measured:nat,count:nat,risk:nat}).returns((e:any)=>{
  const credit = bug===58?e.credited:bug===59?e.actual.eq(e.named):e.credited.and(e.actual.eq(e.named))
  const limit = when(credit,bug===60?2:e.measured,bug===56?24:bug===57?2:0)
  const allows = bug===61?yes:bug===62||bug===105?e.count.gt(limit):e.count.atMost(bug===63?limit.plus(1):limit)
  const risk = bug===65?yes:bug===103?yes.not():bug===104?e.risk.eq(1):e.risk.lt(bug===64?3:2)
  return {limit,ok:bit(allows),risk:bit(risk),risk_ok:bit(risk.and(allows))}
})
export const constructors = {placement,privacy,phone,routing,resources,policy,capacity}
// Generic observation transition for from-any proofs. Every decision overwrites outputs;
// no previous decision is authority for the next. Uses the exact function's returns.
export function observed(mk:any, bug=0) {
  const f=mk(bug), m=f.rule
  return m // request-only decisions have no evolving state; proveSteps is recorded separately.
}
