// Minimal real compiler failure preserved without patching gdp-wired core.
import {writeFileSync} from 'node:fs'
import {compileJs} from '../../core/machine.ts'
import {session} from './port.ts'
const rows=[]
for(const workaround of [false,true]) {
 const r=session('',workaround),input=r.encodeInput({event:'ask',ok:true}),inter=r.interpreter(),compiled=r.compiled()
 const expected=inter.step({},inter.init({}),input)
 try {const got=compiled.step({},compiled.init({}),input);rows.push({workaround,checked:JSON.stringify(expected.scalars)===JSON.stringify(got.scalars),expected:expected.scalars,got:got.scalars,generatedEmptyDeclaration:compileJs(r.machine).includes('let ;')})}
 catch(error){rows.push({workaround,checked:false,error:String(error),expected:expected.scalars,generatedEmptyDeclaration:compileJs(r.machine).includes('let ;'),generated:compileJs(r.machine)})}
}
const result={rows,raw_failure_reproduced:rows[0].generatedEmptyDeclaration&&String(rows[0].error).includes('let'),observational_query_workaround_checked:rows[1].checked===true}
const i=process.argv.indexOf('--json');writeFileSync(process.argv[i+1],JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.raw_failure_reproduced||!result.observational_query_workaround_checked)process.exitCode=1
