// Five manually selected survivors: three concrete semantic gaps and two exact predicate equivalences.
import {readFileSync} from 'node:fs'
import {nat, proveDecision, rule} from '../../core/dsl.ts'
import {interpret, type Request, type State} from '../../core/machine.ts'
import {allowed, watch} from '../../core/watch.ts'
import {domain} from '../../examples/domains/cloud.ts'
import {applyEdit, type Edit} from './mutate.ts'
import {writeJSON} from './battery.ts'

const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
function selected(data: unknown, group: string, id: string) {
  if (!object(data) || data.complete !== true || !Array.isArray(data.mutations)) throw new Error('complete battery required')
  const g = data.mutations.find(g => object(g) && g.id === group)
  if (!object(g) || !Array.isArray(g.rows)) throw new Error('missing group')
  const row = g.rows.find(r => object(r) && r.id === id)
  if (!object(row) || row.status !== 'survived' || !object(row.edit) || !Array.isArray(row.edit.path) || !row.edit.path.every(p => typeof p === 'string' || typeof p === 'number') || !object(row.edit.after) || !object(row.edit.before)) throw new Error('selected mutant must survive')
  // The artifact was generated from these AST types; validate the top-level discriminator at this boundary.
  if (typeof row.edit.after.op !== 'string' || typeof row.edit.before.op !== 'string' || typeof row.edit.operator !== 'string') throw new Error('invalid edit')
  return {row, edit: row.edit as Edit}
}
const stateJSON = (s: State) => JSON.stringify(s, (_k,v)=>v instanceof Map ? [...v] : v)
export function handChecks(battery: unknown) {
  const cases: {group:string,id:string,index:number,classification:'law_suite_gap'|'equivalent',explanation:string,params:Record<string,number>,raw:Request[]}[] = [
    {group:'G0001', id:'M0002', index:0, classification:'law_suite_gap', explanation:'Removing the operation conjunct allows a release to allocate resources. The suite states only Used <= Quota, not operation-specific effects.', params:{}, raw:[{op:0,tenant:0,amount:5},{op:2,tenant:0,amount:2}]},
    {group:'G0002', id:'M0007', index:1, classification:'law_suite_gap', explanation:'Identity update never scales toward demand. Both replica bounds and the upper step-size bound still hold; no progress/target law is stated.', params:{minReplicas:1,maxReplicas:5,stepSize:2}, raw:[{desired:5}]},
    {group:'G0003', id:'M0002', index:2, classification:'law_suite_gap', explanation:'Removing the operation conjunct acquires a free lease on a release request. Holder/owner consistency remains true, but operation semantics are unstated.', params:{}, raw:[{op:1,node:0}]},
    {group:'G0003', id:'M0005', index:2, classification:'equivalent', explanation:'op = 0 and op <= 0 are identical over naturals. The only changed predicate is extensionally equal.', params:{}, raw:[{op:1,node:0},{op:0,node:0}]},
    {group:'G0003', id:'M0008', index:2, classification:'equivalent', explanation:'owner = 0 and owner <= 0 are identical over naturals, in all states, not just the sampled runs.', params:{}, raw:[{op:0,node:0},{op:1,node:0}]},
  ]
  const n = rule('natural zero predicate').inputs({x:nat})
  const v = proveDecision(n.decide('x=0 iff x<=0',()=>[],({x})=>x.eq(0).iff(x.atMost(0))))
  if (!v.proven || !v.checked) throw new Error('predicate equivalence not checked')
  const rows = cases.map(spec => {
    const {row,edit} = selected(battery,spec.group,spec.id), c=domain.cases[spec.index]!
    if(c.kind!=='rule') throw new Error('expected rule')
    const source=c.rule.withSumsOf(c.laws,c.steps??[]).machine, mutant=applyEdit(source,edit), a=interpret(source),b=interpret(mutant), params:Record<string,number>={...spec.params}
    let sa=a.init(params),sb=b.init(params)
    const before={original:sa,mutant:sb}, trace:Request[]=spec.raw.map(r=>({...r})), monitors=[...c.laws,...(c.steps??[])].map(l=>watch(mutant,b,l,params,4))
    if(!monitors.every(m=>m.start(sb))) throw new Error('bad initial state')
    for(const request of trace){
      if(!allowed(source,a,params,sa,request)||!allowed(mutant,b,params,sb,request))throw new Error('illegal hand-check request')
      const previous=sb;sa=a.step(params,sa,request);sb=b.step(params,sb,request)
      if(!monitors.every(m=>m.step(previous,request,sb)))throw new Error('hand check violated a suite law')
    }
    const differs=stateJSON(sa)!==stateJSON(sb)
    if(differs!==(spec.classification==='law_suite_gap'))throw new Error('classification not reproduced')
    return {...spec,edit,status:row.status,likely_equivalent:row.likely_equivalent,initial:before,final:{original:sa,mutant:sb},observably_different:differs,laws_held:true,
      ...(spec.classification==='equivalent'?{predicate_equivalence:{proven:v.proven,checked:v.checked,claim:'forall natural x, x=0 iff x<=0'}}:{})}
  })
  return {method:'manual AST/source inspection plus explicit interpreter traces; equivalent sites justified by a checked universal predicate lemma',count:rows.length,rows}
}
if(import.meta.main){
  const args=process.argv.slice(2),get=(k:string)=>args[args.indexOf(k)+1]
  const input=get('--battery'),out=get('--json')
  if(!input||!out)throw new Error('usage: bun z0/tools/survivors.ts --battery battery-domains.json --json survivors.json')
  writeJSON(out,handChecks(JSON.parse(readFileSync(input,'utf8'))))
}
