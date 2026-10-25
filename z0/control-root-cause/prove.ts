// Proof-only whole-process benchmark; no sampling/search battery cost hidden here.
import {proveDecision} from '../../core/dsl.ts'
import {bendLaws} from './laws.ts'
const family=process.argv[process.argv.indexOf('--family')+1]
const entries=bendLaws.filter(e=>e.src.startsWith(`bend/${family}/`))
if(!entries.length)throw Error(`unknown family ${family}`)
const rows=entries.map(e=>{const c=e.case();if(c.kind!=='decisions')throw Error('expected decision');const v=proveDecision(c.decisions[0]!);return {law:e.law_id,proven:v.proven,checked:v.checked}})
console.log(JSON.stringify({family,laws:rows.length,all_checked:rows.every(r=>r.proven&&r.checked),rows}))
if(rows.some(r=>!r.proven||!r.checked))process.exit(1)
