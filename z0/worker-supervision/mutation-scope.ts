// Exact shared-helper mutation scopes: lstep affects phone Lock/Unlock; holds(Free,a) stays false.
// An incremental verification over the only affected rules; default rules are unchanged.
import {writeFileSync} from 'node:fs'
import {proveSteps} from '../../core/dsl.ts'
import {modelCase} from './laws.ts'
import {device} from './port.ts'
import {witness} from './witness.ts'
const corrections=['lease_steal','lease_release','write_any'].map((bug,i)=>({id:`M0${i+1}`,bug,
 rows:['install_needs_lock','install_lock_no_steal','input_needs_foreground','input_needs_fresh_look'].map(law=>{
  const c=modelCase(law,bug),v=proveSteps(c.rule,c.laws,c.steps,{from:'any',search:false})
  return {law,verdict:v,killed:!v.proven,witness:!v.proven?witness(law,bug):undefined}
 })
}))
function run(bug:string,inputs:any[]){const r=device(bug),rt=r.interpreter(),p=r.encodeParams({});let s=rt.init(p);for(const input of inputs)s=rt.step(p,s,r.encodeInput({app:0,...input}));return r.decode(s)}
const boundary_checks={M01_shared_lock:run('lease_steal',[{op:'Lock',a:1},{op:'Lock',a:2}]),M02_shared_unlock:run('lease_release',[{op:'Lock',a:1},{op:'Unlock',a:2}]),M03_free_still_refused:run('write_any',[{op:'Install',a:2}]),M03_other_held_installs:run('write_any',[{op:'Lock',a:1},{op:'Install',a:2}])}
const ok=boundary_checks.M01_shared_lock.owner===2&&!boundary_checks.M02_shared_unlock.held&&!boundary_checks.M03_free_still_refused.installed&&boundary_checks.M03_other_held_installs.installed
writeFileSync('out/mutation-scope-amendment.json',JSON.stringify({corrections,boundary_checks,ok,scope:'M01-M03 shared device helpers only; default transition functions unchanged'},null,2))
console.log(JSON.stringify({ok,corrections}));if(!ok)process.exitCode=1
