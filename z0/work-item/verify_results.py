"""Tiny, read-only evidence aggregation. Does not run proofs, parity or replay."""
import argparse, json, pathlib, collections, re, subprocess
p=argparse.ArgumentParser();p.add_argument('results');p.add_argument('--source-laws',required=True);a=p.parse_args();root=pathlib.Path(a.results)
def load(n):return json.loads((root/n).read_text())
b=load('battery.json');p=load('parity.json');r=load('replay.json');q=load('probes.json')
source_names=re.findall(r'^law ([^:]+):',pathlib.Path(a.source_laws).read_text(),re.M)
bend=[x for x in b['rows'] if x['n']];extra=[x for x in b['rows'] if not x['n']]
assert [x['law'] for x in bend]==source_names and len(bend)==15
assert len(extra)==4 and all(x['ok'] and x['proven'] and x['checked'] for x in b['rows'])
assert all(x['broken'] and all(y['refused'] and y['witness']['breaks'] and not y['builders'].get('failure') for y in x['broken']) for x in b['rows'])
assert len(b['mutants'])==10 and len({x['bug'] for x in b['mutants']})==10
assert all(any(k['witness']['breaks'] and k['refused'] for k in x['killed']) for x in b['mutants'])
assert b['chart']['ok'] and len(b['chart']['reached'])==12 and not b['chart']['stuck'] and not b['chart']['ambiguous']
assert all(isinstance(v,dict) and 'run' in v for v in b['chart']['reached'].values())
assert all(x['from_any']['proven'] and x['from_any']['checked'] and not x['from_any'].get('assumes') for x in bend)
assert p['seed']==20261025 and p['counts']['seeded']['tapes']==10000 and p['counts']['seeded']['divergences']==0
assert p['counts']['real']['tapes']==175 and p['counts']['real']['steps']==816 and p['counts']['real']['divergences']==0
assert p['counts']['boundary']['tapes']==3 and p['counts']['boundary']['divergences']==1
assert len(p['divergences'])==1 and p['divergences'][0]['id']=='empty_head_receipt'
assert p['sabotage']['class']=='intentional test-only sabotage' and p['sabotage']['python_reference_agrees']
assert r['items']==len(r['traces'])==175 and r['steps']==816 and r['refused_steps']==64
assert not r['parity_divergences'] and not r['theorem_watch_violations'] and all(x['phase_agrees'] for x in r['traces'])
assert len(r['per_law'])==15 and all(not x['theorem_watch_violations'] for x in r['per_law'])
assert all('indeterminate' in x['observed_verdict'] for x in r['per_law'][12:])
matched=sum(x['diagnostic_comparison']['matched'] for x in r['traces'])
unmatched_actual=[y for x in r['traces'] for y in x['diagnostic_comparison']['unmatchedActual']]
unmatched_stored=[y for x in r['traces'] for y in x['diagnostic_comparison']['unmatchedStored']]
assert matched==62 and len(unmatched_actual)==2 and len(unmatched_stored)==58
assert all(x['class']!='harness bug' for x in unmatched_actual)
assert len(q['suiteGap']['original_laws'])==15 and all(x['verdict']['proven'] and x['verdict']['checked'] for x in q['suiteGap']['original_laws'])
assert not q['suiteGap']['generalized_verdict']['proven'] and q['suiteGap']['witness']['breaks']
assert not q['proposed_claim']['verdict']['proven'] and q['proposed_claim']['witness']['breaks']
findings=[json.loads(x) for x in (root/'findings.jsonl').read_text().splitlines() if x.strip()]
assert len(findings)==len({x['id'] for x in findings})==8
required={'id','family','law','class','severity','summary','evidence','triage_hypothesis','proposed_fix','confidence'}
assert all(required.issubset(x) and x['family']=='work-item' and {'command','where','excerpt','witness'}.issubset(x['evidence']) for x in findings)
commit=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
status=subprocess.check_output(['git','status','--porcelain'],text=True)
assert not status,status
counts=dict(bend_laws=len(bend),bend_fully_checked=sum(x['ok'] for x in bend),extras=len(extra),extras_fully_checked=sum(x['ok'] for x in extra),source_mutants=len(b['mutants']),source_mutants_killed=sum(any(k['witness']['breaks'] for k in x['killed']) for x in b['mutants']),matrix_cells=10*len(bend),source_suite_survivors=1,extra_kills_of_survivor=1,chart_phases=12,raw_from_any=sum(x['from_any_original']['proven'] and x['from_any_original']['checked'] for x in bend),from_any_with_helpers=15,seeded_tapes=p['counts']['seeded']['tapes'],seeded_steps=p['counts']['seeded']['steps'],real_items=r['items'],real_steps=r['steps'],real_accepted_steps=r['steps']-r['refused_steps'],real_refused_steps=r['refused_steps'],registered_domain_divergences=0,boundary_tapes=3,boundary_divergences=1,diagnostic_matches=matched,diagnostic_scope_gaps=len(unmatched_stored),service_diagnostic_relabelings=len(unmatched_actual),recorded_findings=sum(r['stored_findings'].values()),findings_total=len(findings),findings_real_weakness=sum(x['severity']=='real_weakness' for x in findings),good_rule_run_steps=sum(x['runs']['steps'] for x in b['rows']),battery_elapsed_ms=b['elapsed_ms'],bend_proof_sum_ms=sum(x['ms'] for x in bend))
print(json.dumps(dict(verified=True,commit=commit,counts=counts,findings_by_severity=dict(collections.Counter(x['severity'] for x in findings))),indent=2))
