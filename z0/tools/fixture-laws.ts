import {nat, rule, when} from '../../core/dsl.ts'
import {machineCase} from '../../examples/harness.ts'
import type {Entry} from '../entry.ts'
export const family = 'synthetic-test'
const r = rule('shared cap fixture').inputs({n:nat}).state({s:0}).step(({n})=>({s:when(n.atMost(3),n,0)}))
const b = r.step(()=>({s:5}))
export const bendLaws: Entry[] = [3,4].map((limit,i)=>({n:i+1,law_id:`cap-${limit}`,src:'synthetic',bend:`cap-${limit}`,says:'synthetic aggregation check',fns:r.name,kind:'law',encoding:'exact',case:()=>machineCase(`cap-${limit}`,'',r,[r.law(`cap-${limit}`,({s})=>s.atMost(limit))],[{name:'constant five',why:'exceeds cap',rule:b,laws:[b.law(`cap-${limit}`,({s})=>s.atMost(limit))]}])}))
export const extras:Entry[] = []
