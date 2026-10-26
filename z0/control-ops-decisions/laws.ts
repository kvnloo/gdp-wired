// Faithful source laws: sqlite-store-laws @ d2e346146380, bend/ops_fsm/LAWS.bend.
// Numeric bug ids 1..65 are source mutations.py positions; >=101 are additional synthetic variants.
import {yes, type Cond} from '../../core/dsl.ts'
import {decisionCase, machineCase} from '../../examples/harness.ts'
import type {Entry} from '../entry.ts'
import * as P from './port.ts'
const none = () => []
// This independent whitelist is LAWS.bend:GrootClass, not port.ts:groot.
const grootSpec = (c:any) => c.is('gpu').or(c.is('bend'),c.is('lean'),c.is('service'),c.is('agent-process'),c.is('tiny'))
const off = (e:any,o:any) => [e.offload,o.ok.eq(1)]
const matched = (e:any) => e.family.eq(e.named_family).and(e.arm.eq(e.named_arm))
const capBase = (e:any) => e.actual.eq(0).and(e.named.eq(0))
export type Spec = {mk:any,given:any,then:any,bugs:number[],line:number}
export const specs: Record<string,Spec> = {}
function D(id:string,line:number,mk:any,given:any,then:any,bugs:number[],encoding:Entry['encoding']='exact',bound=5):Entry {
  specs[id]={mk,given,then,bugs,line}
  return {n:0,law_id:id,src:`bend/ops_fsm/LAWS.bend:${line}`,bend:id,says:id,fns:mk.name,kind:'decide',encoding,how:'automatic',
    case:()=>decisionCase(id,id,[mk().law(id,given,then)],bugs.map(bug=>({name:`mutant-${bug}`,why:id,decision:mk(bug).law(id,given,then)})),{bound})}
}
export const bendLaws:Entry[] = [
 D('o1_groot_admits_only',63,P.placement,(e:any,o:any)=>[e.lane.is('groot'),o.admits.eq(1)],(_o:any,e:any)=>grootSpec(e.cls),[1,2]),
 D('o1_never_groot_fallback',69,P.placement,(_e:any,o:any)=>o.place.eq(1),(_o:any,e:any)=>grootSpec(e.cls),[2,3,5]),
 D('o1_full_waits',77,P.placement,(e:any)=>[grootSpec(e.cls).not(),e.m.not(),e.p.not()],(o:any)=>o.place.eq(0),[3,4,5]),
 D('o1_mbp_takes_heavy',83,P.placement,(e:any)=>[grootSpec(e.cls).not(),e.m],(o:any)=>o.place.eq(2),[6]),
 D('o4_private_stays_private',207,P.privacy,(e:any,o:any)=>[e.private,o.ok.eq(1)],(_o:any,e:any)=>e.vis.is('private'),[22,23]),
 D('o4_nonprivate_free',213,P.privacy,(e:any)=>e.private.not(),(o:any)=>o.ok.eq(1),[24]),
 D('o5_touch_needs_intent',219,P.phone,(e:any,o:any)=>[e.kind.is('tap'),o.ok.eq(1)],(_o:any,e:any)=>e.intent,[25]),
 D('o5_touch_needs_foreground',226,P.phone,(e:any,o:any)=>[e.kind.is('tap'),o.ok.eq(1)],(_o:any,e:any)=>e.fg,[26]),
 D('o5_no_chain_install_in_call',233,P.phone,(e:any)=>[e.kind.is('install'),e.chain,e.call],(o:any)=>o.ok.eq(0),[27]),
 D('o5_no_chain_restart_in_call',237,P.phone,(e:any)=>[e.kind.is('restart'),e.chain,e.call],(o:any)=>o.ok.eq(0),[28]),
 {n:0,law_id:'o6_a11y_superset',src:'bend/ops_fsm/LAWS.bend:244',bend:'o6_a11y_superset',says:'post contains every retained pre service',fns:'a11y_ok',kind:'list/set',encoding:'interned',how:'automatic',
  note:'List membership quotient to sets; order/duplicates cannot change the reference law. first is used only for source mutant 30.',
  case:()=> {const mk=(bug=0)=>{const r=P.accessibility(bug);return {rule:r,laws:[],steps:[r.stepLaw('o6_a11y_superset',(e:any,a:any)=>a.ok.eq(1).and(e.Pre.has(e.x)).implies(e.Post.has(e.x).or(e.Rm.has(e.x))))]}}
   return machineCase('o6_a11y_superset','elementwise superset',mk().rule,[],[29,30,31].map(bug=>({name:`mutant-${bug}`,why:'drop services',...mk(bug)})),{steps:mk().steps,bound:4,depth:3})}},
 D('o7_no_cancelled_provider',255,P.routing,(e:any)=>e.cancelled,(o:any)=>o.ok.eq(0),[32]),
 D('o7_no_sol_design',261,P.routing,(e:any)=>[e.sol,e.design],(o:any)=>o.ok.eq(0),[33]),
 D('o10_phone_no_agent_resource_caps',343,P.resources,none,(o:any,e:any)=>o.ok.eq(P.bitTerm(e.ready)),[42,43,44,45]),
 D('o10_phone_placement_no_agent_resource_caps',351,P.resources,none,(o:any)=>o.place.eq(o.reference_place),[42,43,44,45,46]),
 D('o11_evidence_bound_route',360,P.policy,off,(o:any)=>o.credited.eq(1),[51]),
 D('o11_named_family',371,P.policy,off,(_o:any,e:any)=>e.family.eq(e.named_family),[49,55]),
 D('o11_named_arm',382,P.policy,off,(_o:any,e:any)=>e.arm.eq(e.named_arm),[50,55]),
 D('o11_none_not_credited',394,P.policy,(e:any)=>e.stage.is('none'),(o:any)=>o.credited.eq(0),[47]),
 D('o11_shadow_not_credited',397,P.policy,(e:any)=>e.stage.is('shadow'),(o:any)=>o.credited.eq(0),[48]),
 D('o11_canary_routes',400,P.policy,(e:any)=>[matched(e),e.stage.is('canary'),e.offload,e.healthy,e.abstain.not()],(o:any)=>o.ok.eq(1),[101]),
 D('o11_live_routes',405,P.policy,(e:any)=>[matched(e),e.stage.is('live'),e.offload,e.healthy,e.abstain.not()],(o:any)=>o.ok.eq(1),[101]),
 D('o12_offload_obligation',411,P.policy,(e:any,o:any)=>[e.family.eq(e.named_family),e.stage.is('live'),e.offload.not(),e.healthy,o.ok.eq(1)],(_o:any,e:any)=>e.abstain,[52,53]),
 D('o12_unhealthy_can_fallback',418,P.policy,(e:any)=>[e.family.eq(e.named_family),e.stage.is('live'),e.offload.not(),e.healthy.not(),e.abstain.not()],(o:any)=>o.ok.eq(1),[53,102]),
 D('o12_abstain_can_fallback',423,P.policy,(e:any)=>[e.family.eq(e.named_family),e.stage.is('live'),e.offload.not(),e.healthy,e.abstain],(o:any)=>o.ok.eq(1),[54,102]),
 D('o13_option_capacity',429,P.capacity,(_e:any,o:any)=>o.ok.eq(1),(o:any,e:any)=>e.count.atMost(o.limit),[61,62,63]),
 D('o13_default_zero',438,P.capacity,(e:any)=>e.credited.not(),(o:any)=>o.limit.eq(0),[56,57,59]),
 D('o13_exact_scope',444,P.capacity,(e:any)=>[e.credited,e.actual.ne(e.named)],(o:any)=>o.limit.eq(0),[58]),
 D('o13_credited_limit',451,P.capacity,(e:any)=>[e.credited,e.actual.eq(e.named)],(o:any,e:any)=>o.limit.eq(e.measured),[60]),
 D('o13_k2_rejected',456,P.capacity,(e:any)=>[e.credited.not(),capBase(e),e.measured.eq(119),e.count.eq(2)],(o:any)=>o.ok.eq(0),[56,57,61,62], 'exact',120),
 D('o13_k24_rejected',459,P.capacity,(e:any)=>[e.credited.not(),capBase(e),e.measured.eq(24),e.count.eq(24)],(o:any)=>o.ok.eq(0),[56,61,62], 'exact',120),
 D('o13_k119_rejected',462,P.capacity,(e:any)=>[e.credited.not(),capBase(e),e.measured.eq(119),e.count.eq(119)],(o:any)=>o.ok.eq(0),[61,62], 'exact',120),
 D('o13_credited_excess_rejected',465,P.capacity,(e:any)=>[e.credited,capBase(e),e.measured.eq(3),e.count.eq(4)],(o:any)=>o.ok.eq(0),[61,62,63]),
 D('o13_destructive_never',468,P.capacity,(e:any)=>e.risk.eq(2),(o:any)=>o.risk.eq(0),[64,65]),
 D('o13_unknown_never',471,P.capacity,(e:any)=>e.risk.eq(3),(o:any)=>o.risk.eq(0),[65]),
 D('o13_read_authority',474,P.capacity,(e:any)=>e.risk.eq(0),(o:any)=>o.risk.eq(1),[103]),
 D('o13_reversible_authority',477,P.capacity,(e:any)=>e.risk.eq(1),(o:any)=>o.risk.eq(1),[103]),
 D('o13_destructive_request_never',480,P.capacity,(e:any)=>e.risk.eq(2),(o:any)=>o.risk_ok.eq(0),[64,65]),
]
const sourceOrdinals=[1,2,3,4,16,17,18,19,20,21,22,23,24,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57]
bendLaws.forEach((e,i)=>e.n=sourceOrdinals[i]!)
function X(id:string,mk:any,given:any,then:any,bugs:number[],relate=false):Entry {
 return {n:0,law_id:id,src:'bend/ops_fsm/ops.bend:473-491',bend:id,says:id,fns:mk.name,kind:relate?'relate':'decide',encoding:'exact',how:'automatic',
  case:()=>{const d=(bug=0)=>relate?mk(bug).relate(id,given,then):mk(bug).law(id,given,then)
   return decisionCase(id,id,[d()],bugs.map(bug=>({name:`mutant-${bug}`,why:id,decision:d(bug)})),{bound:5})}}
}
const sameCap = (a:any,b:any)=>a.credited.iff(b.credited).and(a.actual.eq(b.actual),a.named.eq(b.named),a.measured.eq(b.measured),a.count.eq(b.count))
export const extras:Entry[] = [
 X('extra_uncredited_positive_count_never',P.capacity,(e:any)=>[e.credited.not(),e.count.gt(0)],(o:any)=>o.ok.eq(0),[56,57,59,61,62,63]),
 X('extra_all_credited_excess_never',P.capacity,(e:any)=>[e.credited,e.actual.eq(e.named),e.count.gt(e.measured)],(o:any)=>o.ok.eq(0),[61,62,63]),
 X('extra_all_unknown_or_destructive_never',P.capacity,(e:any)=>e.risk.atLeast(2),(o:any)=>o.risk_ok.eq(0),[64,65]),
 X('extra_risk_monotonicity',P.capacity,(a:any,b:any)=>[sameCap(a,b),a.risk.atMost(b.risk)],(x:any,y:any)=>y.risk_ok.atMost(x.risk_ok),[104],true),
 X('extra_capacity_monotonicity',P.capacity,(a:any,b:any)=>[a.credited.iff(b.credited),a.actual.eq(b.actual),a.named.eq(b.named),a.count.eq(b.count),a.measured.atMost(b.measured)],(x:any,y:any)=>x.ok.atMost(y.ok),[105],true),
 X('extra_resource_noninterference',P.resources,(a:any,b:any)=>a.ready.iff(b.ready),(x:any,y:any)=>x.ok.eq(y.ok).and(x.place.eq(y.place)),[42,43,44,45,46],true),
 X('extra_phone_tap_call_noninterference',P.phone,(a:any,b:any)=>[a.kind.is('tap'),b.kind.is('tap'),a.intent.iff(b.intent),a.fg.iff(b.fg)],(x:any,y:any)=>x.ok.eq(y.ok),[106],true),
 X('extra_offload_health_noninterference',P.policy,(a:any,b:any)=>[a.offload,b.offload,a.family.eq(b.family),a.named_family.eq(b.named_family),a.stage.eq(b.stage),a.arm.eq(b.arm),a.named_arm.eq(b.named_arm)],(x:any,y:any)=>x.ok.eq(y.ok),[107],true),
 {n:0,law_id:'extra_a11y_complete',src:'bend/ops_fsm/ops.bend:268-273; src/z0int/fsm/ops.py:204-206',bend:'extra_a11y_complete',says:'A fully retained or owner-removed service set is accepted, not merely safe when accepted',fns:'a11y_ok',kind:'step law',encoding:'interned',how:'automatic',
  case:()=>{const mk=(bug=0)=>{const r=P.accessibility(bug).flags((e:any)=>({complete:P.a11yAccepted(e)}));return {rule:r,laws:[],steps:[r.stepLaw('extra_a11y_complete',(e:any,a:any)=>e.complete.implies(a.ok.eq(1)))]}}
   const a=mk(),b=mk(108);return machineCase('extra_a11y_complete','Reject-all survives the original safety-only law',a.rule,[],[{name:'mutant-108',why:'reject all valid service sets',...b}],{steps:a.steps,bound:4,depth:3})}},
]
// Test-owned guided draws preserve the literal premises of single-case laws. Generic random
// draws rarely hit (actual=named=0, measured=count=119); they are not a reason to relax a law.
export const fixed:Record<string,Record<string,any>> = {
 o13_k2_rejected:{credited:false,actual:0,named:0,measured:119,count:2},
 o13_k24_rejected:{credited:false,actual:0,named:0,measured:24,count:24},
 o13_k119_rejected:{credited:false,actual:0,named:0,measured:119,count:119},
 o13_credited_excess_rejected:{credited:true,actual:0,named:0,measured:3,count:4},
}
// Do not alter proof machines: only constrain the sampling helper to stated premises.
for(const e of [...bendLaws,...extras]) {
 const build=e.case
 e.case=()=> {const c=build(); if(c.kind!=='decisions') return c
  const pin=fixed[e.law_id]
  for(const d of [...c.decisions,...c.broken.map(b=>b.decision)]) {
   const r=d.rule, original=r.randomInput.bind(r)
   r.randomInput=(rand:any,bound:number)=>{const v=original(rand,bound) as any
    if(pin) Object.assign(v,r.encodeInput({...pin,risk:0} as never))
    const pair=(keys:string[])=>keys.forEach(k=>v[`b.${k}`]=v[k])
    if(e.law_id==='extra_risk_monotonicity') {pair(['credited','actual','named','measured','count']); v['b.risk']=v.risk+rand(3)}
    if(e.law_id==='extra_capacity_monotonicity') {pair(['credited','actual','named','count']);v['b.measured']=v.measured+rand(3)}
    if(e.law_id==='extra_resource_noninterference') pair(['ready'])
    if(e.law_id==='extra_phone_tap_call_noninterference') {pair(['intent','fg']);v.kind=0;v['b.kind']=0}
    if(e.law_id==='extra_offload_health_noninterference') {pair(['family','named_family','stage','arm','named_arm']);v.offload=1;v['b.offload']=1}
    return v
   }
  }
  return c
 }
}
