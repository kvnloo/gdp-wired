// A synthetic, source-valid counterexample to completeness of a one-way law suite.
import {writeFileSync} from 'node:fs'
import {proveSteps} from '../../core/dsl.ts'
import * as P from './port.ts'
const raw={Pre:[1],Post:[1],Rm:[],first:1,x:1}
const observe=(bug:number)=>{const r=P.accessibility(bug),i=r.interpreter();return r.decode(i.step({},i.init({}),r.encodeInput(raw)))}
const r=P.accessibility(108),law=r.stepLaw('o6_a11y_superset',(e:any,a:any)=>a.ok.eq(1).and(e.Pre.has(e.x)).implies(e.Post.has(e.x).or(e.Rm.has(e.x))))
const report={classification:'law_suite_gap',severity:'minor',input:raw,reference:observe(0),reject_all:observe(108),original_safety_accepts_reject_all:proveSteps(r,[],[law],{from:'any'}),interpretation:'Reject-all preserves the owner safety theorem but changes a valid decision. This is missing completeness coverage, not evidence of a production bug or an unsafe acceptance.',proposed_extra:'extra_a11y_complete'}
writeFileSync(process.argv[2]??'out/probes.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
if(!(report.original_safety_accepts_reject_all.proven&&report.original_safety_accepts_reject_all.checked&&report.reference.ok===1&&report.reject_all.ok===0))process.exit(1)
