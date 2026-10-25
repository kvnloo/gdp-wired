// Faithful finite obligations; metadata order taken from pinned LAWS.bend files.
import {bool, fun, nat, when} from '../../core/dsl.ts'
import {decisionCase, machineCase} from '../../examples/harness.ts'
import type {Entry} from '../entry.ts'
import * as P from './port.ts'
type Env = any
const none = () => []
const iff = (a: any,b: any) => a.implies(b).and(b.implies(a))
function D(n: number, law_id: string, src: string, mk: (bug?: string) => any, given: any, then: any, bug: string): Entry {
  return {n, law_id, src, bend: law_id, says: law_id, fns: src, kind: 'decide', encoding: 'exact', how: 'automatic',
    case: () => decisionCase(law_id, law_id, [mk().law(law_id, given, then)],
      [{name: bug, why: law_id, decision: mk(bug).law(law_id, given, then)}])}
}
export function rootLaw(id: string, name: string, bug = '') {
 const r = P.root(id, bug), fs = P.fields[id]!
 const all = (e: Env) => P.every(fs.map(f => P.affirmed(e[f])))
 const complete = (e: Env) => P.every(fs.map(f => P.known(e[f])))
 if (name.includes('_pass_needs_')) { const f = name.split('_pass_needs_')[1]!; return r.law(name, (_: Env,o: Env) => o.out.eq(1), (_: Env,e: Env) => P.affirmed(e[f])) }
 if (name.endsWith('_positive_complete')) return r.law(name, all, (o: Env) => o.out.eq(1))
 if (name.endsWith('_negative_complete')) return r.law(name, (e: Env) => complete(e).and(all(e).not()), (o: Env) => o.out.eq(2))
 const f = name.split('_missing_')[1]!.replace(/_unknown$/, '')
 return r.law(name, (e: Env) => e[f].is('absent'), (o: Env) => o.out.eq(0))
}
export const bendLaws: Entry[] = []
const sourceLaws: [string,string,number][] = [["root_cause_fsm", "r1_pass_needs_target", 27], ["root_cause_fsm", "r1_pass_needs_before_metric", 35], ["root_cause_fsm", "r1_pass_needs_functional_probe", 43], ["root_cause_fsm", "r1_pass_needs_expiry_valid", 51], ["root_cause_fsm", "r1_positive_complete", 59], ["root_cause_fsm", "r1_negative_complete", 70], ["root_cause_fsm", "r1_missing_target_unknown", 82], ["root_cause_fsm", "r1_missing_before_metric_unknown", 88], ["root_cause_fsm", "r1_missing_functional_probe_unknown", 94], ["root_cause_fsm", "r1_missing_expiry_valid_unknown", 100], ["root_cause_fsm", "r2_pass_needs_same_metric", 106], ["root_cause_fsm", "r2_pass_needs_in_bounds_twice", 113], ["root_cause_fsm", "r2_pass_needs_separated_24h", 120], ["root_cause_fsm", "r2_positive_complete", 127], ["root_cause_fsm", "r2_negative_complete", 136], ["root_cause_fsm", "r2_missing_same_metric_unknown", 146], ["root_cause_fsm", "r2_missing_in_bounds_twice_unknown", 151], ["root_cause_fsm", "r2_missing_separated_24h_unknown", 156], ["root_cause_fsm", "r3_pass_needs_probe_failed", 161], ["root_cause_fsm", "r3_pass_needs_owned", 168], ["root_cause_fsm", "r3_pass_needs_leased", 175], ["root_cause_fsm", "r3_positive_complete", 182], ["root_cause_fsm", "r3_negative_complete", 191], ["root_cause_fsm", "r3_missing_probe_failed_unknown", 201], ["root_cause_fsm", "r3_missing_owned_unknown", 206], ["root_cause_fsm", "r3_missing_leased_unknown", 211], ["root_cause_fsm", "r4_pass_needs_same_window", 216], ["root_cause_fsm", "r4_pass_needs_share_at_least_30", 222], ["root_cause_fsm", "r4_positive_complete", 228], ["root_cause_fsm", "r4_negative_complete", 235], ["root_cause_fsm", "r4_missing_same_window_unknown", 243], ["root_cause_fsm", "r4_missing_share_at_least_30_unknown", 247], ["root_cause_fsm", "r7_pass_needs_report_only", 251], ["root_cause_fsm", "r7_pass_needs_same_finding", 258], ["root_cause_fsm", "r7_pass_needs_age_expired", 265], ["root_cause_fsm", "r7_positive_complete", 272], ["root_cause_fsm", "r7_negative_complete", 281], ["root_cause_fsm", "r7_missing_report_only_unknown", 291], ["root_cause_fsm", "r7_missing_same_finding_unknown", 296], ["root_cause_fsm", "r7_missing_age_expired_unknown", 301], ["root_cause_fsm", "r3_result_rollback_sound", 308], ["root_cause_fsm", "r3_result_rollback_complete", 314], ["artifact_lease_fsm", "g_needs_expired", 11], ["artifact_lease_fsm", "g_needs_allowlisted", 20], ["artifact_lease_fsm", "g_needs_nonlive", 29], ["artifact_lease_fsm", "g_needs_no_symlink", 38], ["artifact_lease_fsm", "g_needs_archive", 47], ["artifact_lease_fsm", "g_complete", 56], ["placement_fsm", "unavailable_unknown", 11], ["placement_fsm", "unscoped_agent_violation", 16], ["placement_fsm", "scoped_agent_pass", 19], ["placement_fsm", "non_agent_pass", 22]]
for (const [i, [fam, name, line]] of sourceLaws.entries()) {
 const src = `bend/${fam}/LAWS.bend:${line}`
 if (fam === 'root_cause_fsm' && !name.startsWith('r3_result_')) {
  const id = name.split('_')[0]!, f = name.includes('_pass_needs_') ? name.split('_pass_needs_')[1] : name.includes('_missing_') ? name.split('_missing_')[1]!.replace(/_unknown$/, '') : ''
  const bug = f ? `${name.includes('_pass_needs_') ? 'affirmed' : 'known'} bypass ${f}` : name.endsWith('_positive_complete') ? 'always SViolation{}' : 'always SUnknown{}'
  bendLaws.push({n:i+1, law_id:name,src,bend:name,says:name,fns:`${id} (root.bend:75-105; root_cause.py:22-41)`,kind:'decide',encoding:'exact',case:()=>decisionCase(name,name,[rootLaw(id,name)],[{name:bug,why:name,decision:rootLaw(id,name,bug)}])})
 } else if (fam === 'root_cause_fsm') {
  bendLaws.push(name.endsWith('_sound') ? D(i+1,name,src,P.finish,(_: Env,o: Env)=>o.out.eq(3),(_: Env,e: Env)=>e.v.is('pass'),'rollback without gate')
   : D(i+1,name,src,P.finish,(e: Env)=>e.v.is('pass'),(o: Env)=>o.out.eq(3),'drop rollback'))
 } else if (fam === 'artifact_lease_fsm') {
  const pos = ['g_needs_expired','g_needs_allowlisted','g_needs_nonlive','g_needs_no_symlink','g_needs_archive'].indexOf(name)
  bendLaws.push(pos >= 0 ? D(i+1,name,src,P.lease,(_: Env,o: Env)=>o.out.eq(1),(_: Env,e: Env)=>e[P.leaseFields[pos]!],P.leaseMutants[pos]!)
   : D(i+1,name,src,P.lease,(e: Env)=>P.every(P.leaseFields.map(f=>e[f])),(o: Env)=>o.out.eq(1),'always false'))
 } else {
  const [given,want,bug] = ({
   unavailable_unknown:[(e: Env)=>e.available.not(),0,'unavailable_pass'],
   unscoped_agent_violation:[(e: Env)=>e.available.and(e.agent,e.scoped.not()),2,'unscoped_pass'],
   scoped_agent_pass:[(e: Env)=>e.available.and(e.agent,e.scoped),1,'scoped_violation'],
   non_agent_pass:[(e: Env)=>e.available.and(e.agent.not()),1,'non_agent_violation']
  } as any)[name]
  bendLaws.push(D(i+1,name,src,P.placement,given,(o: Env)=>o.out.eq(want),bug))
 }
}
export const extras: Entry[] = []
for (const [id,fs] of Object.entries(P.fields)) {
 extras.push(D(0,`${id}_total_partition`,'bend/root_cause_fsm/root.bend:75-88',b=>P.root(id,b),none,(o: Env)=>o.out.atMost(2),'bad verdict'))
 extras.push(D(0,`${id}_unknown_iff_missing`,'bend/root_cause_fsm/root.bend:75-88',b=>P.root(id,b),none,(o: Env,e: Env)=>iff(o.out.eq(0),P.every(fs.map(f=>P.known(e[f]))).not()),`known bypass ${fs[0]}`))
 const mk = (bug='') => fun(`${id} with irrelevant metadata`).inputs({...Object.fromEntries(fs.map(f=>[f,P.evidence])), metadata:nat})
   .returns((e: Env)=>({out:when(bug ? e.metadata.eq(1) : e.metadata.lt(0),1,P.rootTerm(id)(e))}))
 const law = (r: any) => r.relate(`${id}_metadata_noninterference`,(a: Env,b: Env)=>P.every(fs.map(f=>a[f].eq(b[f]))),(x: Env,y: Env)=>x.out.eq(y.out))
 extras.push({n:0,law_id:`${id}_metadata_noninterference`,src:'src/z0int/fsm/root_cause.py:18-41',bend:`${id}_metadata_noninterference`,says:'unread metadata cannot change the decision',fns:id,kind:'relate',encoding:'exact',case:()=>decisionCase(`${id}_metadata_noninterference`,'two calls, identical relevant evidence, arbitrary metadata',[law(mk())],[{name:'metadata changes verdict',why:'noninterference',decision:law(mk('read metadata'))}])})
 const name = `${id}_missing_after_pass_never_pass`
 const ss = (r: any) => [r.stepLaw(name,(e: Env,a: Env)=>P.every(fs.map(f=>P.known(e[f]))).not().implies(a.out.eq(1).not()))]
 extras.push({n:0,law_id:name,src:'bend/root_cause_fsm/root.bend:75-88',bend:name,says:'missing current evidence cannot inherit an earlier pass',fns:id,kind:'step law',encoding:'exact',case:()=>machineCase(name,name,P.observe(id),[],[{name:'retain previous pass',why:name,rule:P.observe(id,'retain previous pass'),laws:[],steps:ss(P.observe(id,'retain previous pass'))}],{steps:ss(P.observe(id)),depth:8})})
}
extras.push(D(0,'lease_eligibility_iff_all','bend/artifact_lease_fsm/lease.bend:5',P.lease,none,(o: Env,e: Env)=>iff(o.out.eq(1),P.every(P.leaseFields.map(f=>e[f]))),'unexpired'))
extras.push(D(0,'placement_general_form','bend/placement_fsm/placement.bend:9',P.placement,none,(o: Env,e: Env)=>iff(o.out.eq(0),e.available.not()).and(iff(o.out.eq(2),e.available.and(e.agent,e.scoped.not()))),'unavailable_pass'))
function streamExtra(name: string, pred: any, bug: string): Entry {
 const steps = (r: any) => [r.stepLaw(name,(e: Env,a: Env)=>pred(e,a))]
 return {n:0,law_id:name,src:'src/z0int/fsm/artifact_leases.py:64-73',bend:name,says:name,fns:'inspect',kind:'step law',encoding:'abstracted',case:()=>machineCase(name,name,P.leaseObservation(),[],[{name:bug,why:name,rule:P.leaseObservation(bug),laws:[],steps:steps(P.leaseObservation(bug))}],{steps:steps(P.leaseObservation()),depth:6,bound:4})}
}
extras.push(streamExtra('lease_before_expiry_never_eligible',(e: Env,a: Env)=>e.now.lt(e.created.plus(e.ttl)).implies(a.eligible.eq(0)),'ignore expiry'))
extras.push(streamExtra('lease_archive_loss_revokes_eligibility',(e: Env,a: Env)=>e.archive_ready.not().implies(a.eligible.eq(0)),'cache previous pass'))
extras.push(streamExtra('lease_no_stale_pass',(e: Env,a: Env)=>a.eligible.eq(P.leaseTerm({...e,expired:e.now.atLeast(e.created.plus(e.ttl))})),'cache previous pass'))
