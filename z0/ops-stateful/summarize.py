"""Aggregate saved evidence, never execute proofs on the controller host."""
import argparse
import json
from pathlib import Path
import re
import runpy

ap=argparse.ArgumentParser()
ap.add_argument('results',type=Path)
ap.add_argument('--source',type=Path,required=True)
a=ap.parse_args()
p=a.results
read=lambda name:json.loads((p/name).read_text())
b=read('battery.json');c=read('critic.json');parity=read('parity.json');replay=read('replay.json')
selected=lambda s:bool(re.match(r'o(?:2|3|8|9)_',s))
source=a.source/'bend/ops_fsm'
names=re.findall(r'^law (\w+):',(source/'LAWS.bend').read_text(),re.M)
wanted=[n for n in names if selected(n)]
actual=[r['law'] for r in b if r['n']>0]
assert wanted==actual and len(wanted)==19
for r in b:
    if r['n']>0: assert names[r['n']-1]==r['law']
mutations=runpy.run_path(str(source/'mutations.py'))['MUTATIONS']
mutations=[m for m in mutations if m[0].split()[0] in {'O2','O3','O8','O9'}]
labels=['all-ops','rollback-outside','no-rollback','ff-outside','ignore-lease','no-ff','ignore-ff','ignore-idle',
'ignore-clean','promote-failure','defer-failure','ignore-review','ignore-call','run-deferred','refuse-all',
'silent','unmarked','repeat-notice','rearm','restart-fails','restart-ignored','interrupted-fails','sessionless']
assert len(mutations)==len(labels)==len(c['original_mutants'])==23
inventory=[]
for m,label in zip(mutations,labels):
    matches=[x for x in c['original_mutants'] if x['bug']==label]
    assert len(matches)==1
    row=matches[0]
    assert not row['survives'] and row['broken_by_draw']
    assert m[0].split()[1] in {x['law'] for x in row['kills']}
    inventory.append({'source_law':m[0],'source_mutation':m[1],'ported_bug':label,'decision_family':row['family'],'kills':row['kills']})
(p/'mutations_inventory.json').write_text(json.dumps(inventory,indent=2)+'\n')
findings=[json.loads(x) for x in (p/'findings.jsonl').read_text().splitlines()]
counts={
'bend_laws':len(actual),'bend_proven_checked':sum(x['proven'] and x['checked'] for x in b if x['n']>0),
'bend_triple_ok':sum(x['ok'] for x in b if x['n']>0),'run_extras':sum(x['n']==0 for x in b),
'run_extras_triple_ok':sum(x['ok'] for x in b if x['n']==0),
'run_extras_from_any':sum(x['from_any'].get('proven',False) and x['from_any'].get('checked',False) for x in b if x['n']==0),
'incident_claims':len(c['incident_claims']),'incident_claims_refuted_by_run':sum(not x['verdict']['proven'] and x['witness']['breaks'] for x in c['incident_claims']),
'original_mutants':len(inventory),'original_mutants_killed_and_witnessed':sum(not x['survives'] and x['broken_by_draw'] for x in c['original_mutants']),
'automatic_mutants':len(c['automatic_mutants']),'automatic_mutants_witnessed_kills':sum(bool(x['violation']) for x in c['automatic_mutants']),
'automatic_mutants_unclassified':sum(not x['violation'] for x in c['automatic_mutants']),
'charts':len(c['charts']),'charts_clean':sum(x['check']['ok'] for x in c['charts']),
'generalizations':len(c['generalizations']),'generalizations_proven_checked':sum(x['verdict']['proven'] and x['verdict']['checked'] for x in c['generalizations']),
'invariant_searches':len(c['invariant_search']),'invariant_searches_successful':sum(x['inferred']['proven'] and x['inferred']['checked'] for x in c['invariant_search']),
'parity_cases':parity['total'],'parity_divergences':len(parity['divergences']),
'replay_tapes':len(replay['stock_replay']),'replay_items':replay['counts']['total'],
'replay_run_transitions':sum(x.get('steps',1) for x in replay['rows']),
'replay_divergences':len(replay['divergences']),'findings':len(findings),
'findings_real_weakness_proposed':sum(x['severity']=='real_weakness' for x in findings),
}
(p/'counts.json').write_text(json.dumps(counts,indent=2)+'\n')
def block_lines(text,prefix):
    blocks=re.findall(rf'^{prefix}[^\n]+\n(?:[^\n]+\n)*',text,re.M)
    return sum(sum(bool(line.strip()) and not line.lstrip().startswith('#') for line in block.splitlines()) for block in blocks)
root=Path(__file__).resolve().parent
cost={'method':'Single execution proof wall time, includes case construction; ms is whole triple check. Named Bend law/proof block nonblank/noncomment lines exclude shared proof helpers; these are descriptive counts, not an authoring benchmark.',
'bend_law_named_lines':block_lines((source/'LAWS.bend').read_text(),r'law o(?:2|3|8|9)_'),
'bend_proof_named_lines':block_lines((source/'PROOF.bend').read_text(),r'def Laws.o(?:2|3|8|9)_'),
'port_files_lines':{f.name:len(f.read_text().splitlines()) for f in root.iterdir() if f.suffix in {'.ts','.py'}},
'proof_ms_bend_sum':sum(x.get('proof_ms',0) for x in b if x['n']>0),
'proof_ms_extras_sum':sum(x.get('proof_ms',0) for x in b if x['n']==0),
'battery_ms_sum':sum(x.get('ms',0) for x in b)}
(p/'cost.json').write_text(json.dumps(cost,indent=2)+'\n')
print(json.dumps({'counts':counts,'cost':cost},indent=2))
