import {expect, test} from 'bun:test'
import {mkdtempSync, readFileSync, rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {battery} from './battery.ts'

test('generic battery merges shared implementations and writes witnessed law-by-mutant matrix', async () => {
  const root=mkdtempSync(join(tmpdir(),'gdp-battery-test-'))
  try {
    const out=join(root,'battery.json')
    const result=await battery(new URL('./fixture-laws.ts',import.meta.url).pathname,out,{cap:200,trials:30,seed:7})
    expect(result.complete).toBe(true)
    expect(result.summary.entries).toBe(2); expect(result.summary.ok).toBe(2)
    expect(result.mutations.length).toBe(1)
    expect(result.summary.mutation.killed).toBeGreaterThan(0)
    const saved=readFileSync(out,'utf8')
    expect(saved).toContain('"matrix"'); expect(saved).toContain('"cap-3"'); expect(saved).toContain('"cap-4"'); expect(saved).toContain('"witness"')
    expect(saved).toContain('"proof_scope": "suite"')
  } finally {rmSync(root,{recursive:true,force:true})}
},20000)
