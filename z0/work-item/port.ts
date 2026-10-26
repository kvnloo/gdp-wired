// Pinned source d2e34614638059b38da77fd5f0bb582af500a503 (read-only).
// Table: bend/work_item_fsm/fsm.bend:194-343; src/z0int/fsm/work_item.py:186-254.
// Role guards: fsm.bend:83-154; work_item.py:33-36,178-183.
// Availability/board: fsm.bend:373-446; work_item.py:257-277.
// Flat context forgets fields not carried by the current Bend constructor (decodeItem).
import {nat, upTo, bool, rule, when, yes, no} from '../../core/dsl.ts'
import {chart} from '../../core/chart.ts'
export const phases = ['Proposed','Claimed','Implementing','Verifying','DraftPR','Integrated','Deployed','OwnerAccepted','Merged','Blocked','Interrupted','Abandoned'] as const
export const events = ['Claim','Start','Push','Submit','Verify','Integrate','Deploy','Observe','Accept','Merge','Block','Unblock','Interrupt','Resume','Abandon'] as const
export const roles = ['owner','opus','sol','chat','free','jev','slm','ci'] as const
export const fields = ['phase','au','ar','hd','ig','dp','ap','apr'] as const
export type Env = any
export const PH = Object.fromEntries(phases.map((p,i)=>[p,i])) as Record<string,number>
export const EV = Object.fromEntries(events.map((p,i)=>[p,i])) as Record<string,number>
export const initial = {phase:0,au:0,ar:0,hd:0,ig:0,dp:0,ap:0,apr:0}
export const payload = {actor:nat,role:upTo(7),sha:nat,rsha:nat,passed:bool}
export const inputs = {ev:upTo(14),...payload}
export const coder = (r:Env) => r.eq(1).or(r.eq(2))
const operator = (r:Env) => r.eq(7).or(r.eq(1))
const steward = (r:Env) => r.eq(0).or(r.eq(1))
export const bugs = ['merge-before-accept','self-verify','any-accept','unbound-receipt','stale-deploy','ignore-drift','lose-resume-head','free-coder','hold-all','owner-fires'] as const
export type Bug = typeof bugs[number] | 'no-opus-resume' | 'self-integrate' | 'no-resume' | 'no-abandon' | 'board-broadcast' | 'reopen-merged' | undefined
const truth = (b:boolean) => b ? yes:no
export type Edge = {from:string[],to:string,event:string,guard:(e:Env)=>Env,set?:(e:Env)=>Env}
export function table(bug?:Bug):Edge[] {
 const code=(r:Env)=>coder(r).or(truth(bug==='free-coder').and(r.eq(4)))
 const receipt=(e:Env,h:Env)=>e.passed.and(bug==='unbound-receipt'?yes:e.rsha.eq(h))
 const vg=(e:Env)=>e.role.eq(7).and(bug==='self-verify'?yes:e.actor.eq(e.au).not())
 const ig=(e:Env)=>operator(e.role).and(bug==='self-integrate'?yes:e.actor.eq(e.au).not()).and(receipt(e,e.sha))
 const ag=(e:Env)=>(bug==='any-accept'?yes:e.role.eq(0)).and(e.actor.eq(e.au).not())
 const edge=(from:string|string[],event:string,to:string,guard:(e:Env)=>Env=()=>yes,set?:(e:Env)=>Env):Edge=>({from:Array.isArray(from)?from:[from],event,to,guard,set})
 const out:Edge[]=[
 edge('Proposed','Claim','Claimed',e=>code(e.role),e=>({au:e.actor,ar:e.role})),
 edge('Claimed','Start','Implementing',e=>e.actor.eq(e.au),()=>({hd:0})),
 edge('Implementing','Push','Implementing',e=>e.actor.eq(e.au),e=>({hd:e.sha})),
 edge('Implementing','Submit','Verifying',e=>e.actor.eq(e.au)),
 edge('Verifying','Verify','DraftPR',e=>vg(e).and(receipt(e,e.hd))),
 edge('Verifying','Verify','Implementing',e=>vg(e).and(receipt(e,e.hd).not())),
 edge('DraftPR','Integrate','Integrated',ig,e=>({ig:e.sha})),
 edge('Integrated','Deploy','Deployed',e=>operator(e.role).and(bug==='stale-deploy'?yes:e.sha.eq(e.ig)),e=>({dp:e.sha})),
 edge('Deployed','Observe','Integrated',e=>bug==='ignore-drift'?no:e.sha.eq(e.ig).not()),
 edge('Deployed','Accept','OwnerAccepted',ag,e=>({ap:e.actor,apr:e.role})),
 edge('OwnerAccepted','Merge','Merged',e=>e.role.eq(0).or(e.role.eq(7))),
 edge(['Implementing','Verifying'],'Block','Blocked'),
 edge('Blocked','Unblock','Implementing',e=>steward(e.role)),
 edge('Claimed','Interrupt','Interrupted',()=>yes,()=>({hd:0})),
 edge(['Implementing','Verifying'],'Interrupt','Interrupted'),
 edge('Interrupted','Resume','Implementing',e=>bug==='no-resume'?no:bug==='no-opus-resume'?e.role.eq(2):code(e.role),e=>({au:e.actor,ar:e.role,hd:bug==='lose-resume-head'?0:e.hd})),
 edge(['Proposed','Claimed','Blocked','Interrupted'],'Abandon','Abandoned',e=>bug==='no-abandon'?no:steward(e.role)),
 ]
 if(bug==='merge-before-accept')out.push(edge('Deployed','Merge','Merged',()=>yes,e=>({ap:e.actor,apr:e.role})))
 if(bug==='reopen-merged')out.push(edge('Merged','Claim','Claimed',e=>code(e.role),e=>({au:e.actor,ar:e.role})))
 return out
}
export function delta(e:Env,bug?:Bug) {
 let out:any=Object.fromEntries(fields.map(f=>[f,e[f]]))
 for(const t of table(bug).toReversed()){
  const on=t.from.map(p=>e.phase.eq(PH[p])).reduce((a,b)=>a.or(b)).and(e.ev.eq(EV[t.event]),t.guard(e))
  const changes={phase:PH[t.to],...(t.set?.(e)??{})}
  for(const [f,v] of Object.entries(changes))out[f]=when(on,v as never,out[f])
 }
 return out
}
// Ghosts count actual entries, not event labels: a repeated refused Merge is not a second merge.
export function lifecycle(bug?:Bug) {
 return rule('work-item').inputs(inputs).state({...initial,accepts:0,merges:0}).step((e:Env)=>{
  const d=delta(e,bug)
  return {...d,accepts:e.accepts.plus(when(e.phase.eq(6).and(d.phase.eq(7)),1,0)),merges:e.merges.plus(when(e.phase.eq(8).not().and(d.phase.eq(8)),1,0))}
 })
}
export function statechart(bug?:Bug){
 let c:any=chart('work-item').inputs(payload).context({au:0,ar:0,hd:0,ig:0,dp:0,ap:0,apr:0})
 .events(...events).states(Object.fromEntries(phases.map(p=>[p,p==='Merged'||p==='Abandoned'?{final:true}:{}])),{field:'phase'})
 for(const t of table(bug)) c=c.on(t.event,{from:t.from,to:t.to,when:t.guard,...(t.set?{set:t.set}:{})})
 return c
}
export const ownerEvent=(e:Env)=>e.role.eq(0).and(e.ev.eq(EV.Observe).not(),e.ev.eq(EV.Interrupt).not())
export function available(e:Env,bug?:Bug){
 const hold=bug==='owner-fires'?no:e.av.eq(2).and(bug==='hold-all'?yes:ownerEvent(e))
 const d=delta(e,bug)
 return Object.fromEntries(fields.map(f=>[f,when(hold,e[f],d[f])]))
}
// Pointwise board projection: arbitrary list length n and observed index j; nth beyond n = Abandoned.
// For any finite list, this projection commutes with fsm.bend:429 board_step by index cases.
// No finite board bound or bounded list induction is substituted for the law.
export function board(bug?:Bug){
 const params:any={n:nat,j:nat}
 for(const f of fields)params['p_'+f]=f==='phase'?upTo(11):nat
 return rule('board projection').params(params).inputs({...inputs,av:upTo(2),i:nat})
 .state(Object.fromEntries(fields.map(f=>[f,(p:Env)=>when(p.j.lt(p.n),p['p_'+f],f==='phase'?11:0)])))
 .step((e:Env)=>{
  const d=available(e,bug), target=delta(e,bug)
  const hit=(bug==='board-broadcast'?yes:e.i.eq(e.j)).and(e.j.lt(e.n),e.i.lt(e.n))
  const out:any={}
  for(const f of fields)out[f]=when(hit,d[f],e[f])
  return out
 })
}
// Equality of Bend constructors: unused flat fields deliberately do not participate.
export function sameItem(a:Env,b:Env){
 const same=(fs:string[])=>fs.reduce((c,f)=>c.and(a[f].eq(b[f])),yes)
 const cases=phases.map((_,i)=>{
  const fs=i===0||i===11?[]:i===1?['au','ar']:['au','ar','hd',...([5,6,7,8].includes(i)?['ig']:[]),...(i===6?['dp']:[]),...([7,8].includes(i)?['ap','apr']:[])]
  return a.phase.eq(i).and(same(fs))
 })
 return a.phase.eq(b.phase).and(cases.reduce((x,y)=>x.or(y)))
}
export function decodeItem(d:any){
 const phase=phases[d.phase]; const o:any={phase}
 if(![0,11].includes(d.phase))o.au={id:d.au,role:roles[d.ar]}
 if(![0,1,11].includes(d.phase))o.hd=d.hd
 if([5,6,7,8].includes(d.phase))o.ig=d.ig
 if(d.phase===6)o.dp=d.dp
 if([7,8].includes(d.phase))o.ap={id:d.ap,role:roles[d.apr]}
 return o
}
export const happy=[
 {ev:0,actor:1,role:2},{ev:1,actor:1,role:2},{ev:2,actor:1,role:2,sha:1},{ev:3,actor:1,role:2},
 {ev:4,actor:2,role:7,rsha:1,passed:true},{ev:5,actor:3,role:1,sha:2,rsha:2,passed:true},
 {ev:6,actor:2,role:7,sha:2},{ev:8,actor:4,role:0},{ev:9,actor:2,role:7}
].map(x=>({sha:0,rsha:0,passed:false,...x}))
