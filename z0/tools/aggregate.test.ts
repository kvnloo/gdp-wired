import {expect, test} from 'bun:test'
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {aggregate, markdown} from './aggregate.ts'

test('aggregation supports missing families, array batteries, malformed data and avoids remeasurement double counting', () => {
  const root = mkdtempSync(join(tmpdir(), 'gdp-tools-test-'))
  try {
    const dir = join(root, 'work-item'); mkdirSync(dir)
    const rows = [{n:1, proven:true, checked:true, ok:true, ms:2}, {n:0, proven:false, checked:false, ok:false, ms:3}]
    writeFileSync(join(dir, 'battery.json'), JSON.stringify(rows))
    writeFileSync(join(dir, 'battery-shared.json'), JSON.stringify({complete:false, rows:[rows[0]]}))
    writeFileSync(join(dir, 'battery-corrupt.json'), '{')
    writeFileSync(join(dir, 'findings.jsonl'), [JSON.stringify({id:'F1',class:'law_suite_gap',severity:'minor'}), JSON.stringify({id:'F1',class:'law_suite_gap',severity:'minor'}), 'invalid'].join('\n'))
    mkdirSync(join(root, 'attempts'))
    const result = aggregate(root), f = result.families.find(f => f.family === 'work-item')!
    expect(result.families.length).toBe(8)
    expect(f.selected?.entries).toBe(2); expect(f.selected?.proven_checked).toBe(1)
    expect(f.datasets.length).toBe(2); expect(f.findings).toBe(1)
    expect(f.by_class).toEqual({law_suite_gap:1}); expect(result.errors.length).toBe(3)
    expect(result.families.filter(f=>f.status==='MISSING').length).toBe(7)
    expect(markdown(result)).toContain('law_suite_gap')
  } finally { rmSync(root, {recursive:true, force:true}) }
})
