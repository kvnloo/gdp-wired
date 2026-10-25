import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs'
import {join, resolve} from 'node:path'

const expected = ['work-item', 'worker-supervision', 'ops-stateful', 'ops-sqlite', 'intent-gate', 'control-root-cause', 'control-ops-decisions', 'tools']
const obj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const num = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : null
const tally = (xs: Record<string, unknown>[], key: string) => Object.fromEntries([...new Set(xs.map(x => String(x[key] ?? 'unknown')))].sort().map(k => [k, xs.filter(x => String(x[key] ?? 'unknown') === k).length]))
export function aggregate(root: string) {
  const errors: string[] = [], families = []
  const directories = existsSync(root) ? readdirSync(root, {withFileTypes: true}).filter(d => d.isDirectory()).map(d => d.name) : []
  for (const family of [...new Set([...expected, ...directories])].sort()) {
    const dir = join(root, family), datasets = [], findings: Record<string, unknown>[] = [], seen = new Set<string>()
    if (existsSync(dir)) for (const file of readdirSync(dir).filter(f => /^battery.*\.json$/.test(f)).sort()) {
      try {
        const data: unknown = JSON.parse(readFileSync(join(dir, file), 'utf8'))
        const rawRows = Array.isArray(data) ? data : obj(data) ? data.rows : null
        if (!Array.isArray(rawRows) || !rawRows.every(obj)) throw new Error('expected rows array')
        const rows: Record<string, unknown>[] = rawRows
        const mutation = obj(data) && obj(data.summary) && obj(data.summary.mutation) ? data.summary.mutation : null
        const elapsed = obj(data) ? num(data.elapsed_ms) : null
        datasets.push({file, complete: obj(data) && typeof data.complete === 'boolean' ? data.complete : null,
          entries: rows.length, bend: rows.filter(r => typeof r.n === 'number' && r.n > 0).length,
          extras: rows.filter(r => r.n === 0).length, proven_checked: rows.filter(r => r.proven === true && r.checked === true).length,
          ok: rows.filter(r => r.ok === true).length, mutation, elapsed_ms: elapsed,
          proof_ms: rows.reduce((sum, r) => sum + (num(r.ms) ?? 0), 0),
          from_any_checked: rows.filter(r => obj(r.from_any) && r.from_any.proven === true && r.from_any.checked === true && !r.from_any.assumes).length,
          assumes: rows.filter(r => Array.isArray(r.assumes) ? r.assumes.some(Boolean) : !!r.assumes).length})
      } catch (error) { errors.push(`${family}/${file}: ${String(error)}`) }
    }
    if (existsSync(join(dir, 'findings.jsonl'))) {
      const lines = readFileSync(join(dir, 'findings.jsonl'), 'utf8').split('\n')
      for (const [i, line] of lines.entries()) if (line.trim()) {
        try {
          const f: unknown = JSON.parse(line)
          if (!obj(f) || typeof f.id !== 'string' || typeof f.class !== 'string' || typeof f.severity !== 'string') throw new Error('invalid finding')
          if (seen.has(f.id)) { errors.push(`${family}/findings.jsonl:${i+1}: duplicate id ${f.id}`); continue }
          seen.add(f.id); findings.push(f)
        } catch (error) { errors.push(`${family}/findings.jsonl:${i+1}: ${String(error)}`) }
      }
    }
    // Canonical worker result, never add a shared remeasurement to the same denominator.
    const selected = datasets.find(d => d.file === 'battery.json') ?? (datasets.length === 1 ? datasets[0] : undefined)
    families.push({family, status: !datasets.length ? 'MISSING' : selected?.complete === false ? 'INCOMPLETE' : selected && selected.ok !== selected.entries ? 'ISSUES' : 'PRESENT',
      selected: selected ?? null, datasets, findings: findings.length, by_class: tally(findings, 'class'), by_severity: tally(findings, 'severity')})
  }
  return {schema: 'gdp-wired-matrix-v1', generated_at: new Date().toISOString(), root, families, errors,
    note: 'Missing results are unknown, not failures. Auxiliary battery datasets remain separate; no double counting. Scores exclude only likely equivalence, not unknown mutants. Findings are unadjudicated evidence.'}
}
export function markdown(result: ReturnType<typeof aggregate>) {
  const lines = ['# gdp-wired law experiment matrix', '', result.note, '', '| Family | Status | Entries | Proven & checked | Triple check | Findings | Mutants K/S/U/LE | Score | Battery ms |', '|---|---|---:|---:|---:|---:|---|---:|---:|']
  const esc = (v: string) => v.replaceAll('|', '\\|').replaceAll('\n',' ')
  for (const f of result.families) {
    const d = f.selected, m = d?.mutation
    lines.push(`| ${esc(f.family)} | ${f.status} | ${d?.entries ?? '—'} | ${d?.proven_checked ?? '—'} | ${d?.ok ?? '—'} | ${f.findings} | ${m ? [m.killed,m.survived,m.unknown,m.likely_equivalent].join('/') : '—'} | ${m && typeof m.mutation_score === 'number' ? m.mutation_score.toFixed(4) : '—'} | ${d?.elapsed_ms?.toFixed(1) ?? '—'} |`)
    if (f.datasets.length || f.findings) lines.push('', `### ${esc(f.family)} datasets and findings`, '', ...f.datasets.map(d => `- ${d.file}: ${d.proven_checked}/${d.entries} proven & checked; ${d.ok} triple-check; complete=${d.complete ?? 'not recorded'}; mutation=${JSON.stringify(d.mutation)}; elapsed_ms=${d.elapsed_ms ?? 'not recorded'}.`), `- Classes: ${JSON.stringify(f.by_class)}`, `- Severities: ${JSON.stringify(f.by_severity)}`, '')
  }
  if (result.errors.length) lines.push('', '## Input errors', ...result.errors.map(e => `- ${esc(e)}`))
  return lines.join('\n') + '\n'
}
if (import.meta.main) {
  const i = process.argv.indexOf('--root'), root = resolve(i >= 0 ? process.argv[i + 1]! : '/mnt/zer0models/workspace/zer0/data/operations/gdp-wired-laws')
  mkdirSync(root, {recursive: true})
  const result = aggregate(root)
  writeFileSync(join(root, 'matrix.json'), JSON.stringify(result, null, 1) + '\n')
  writeFileSync(join(root, 'MATRIX.md'), markdown(result))
  process.stdout.write(JSON.stringify({families: result.families.length, errors: result.errors.length, root}) + '\n')
}
