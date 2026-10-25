"""Line comparison with explicit accounting; no claim of comparable authoring effort."""
import argparse,json,re,statistics
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--results',required=True);a=p.parse_args()
s=Path(a.source)/'bend/ops_fsm';o=Path(a.results);rows=json.loads((o/'battery.json').read_text());ids={r['law'] for r in rows if r['n']}
def file_count(path):
    text=Path(path).read_text();lines=text.splitlines();return dict(physical=len(lines),nonblank=sum(bool(x.strip()) for x in lines),noncomment_nonblank=sum(bool(x.strip()) and not x.lstrip().startswith(('#','//')) for x in lines))
def blocks(text,kind):
    # End a declaration on next top-level noncomment token, not on in-body whitespace/comments.
    lines=text.splitlines();ans={};i=0
    while i<len(lines):
        m=re.match(r'^'+kind+r' ([\w.]+)',lines[i])
        if not m:i+=1;continue
        start=i;i+=1
        while i<len(lines) and (not lines[i].strip() or lines[i][0].isspace() or lines[i].startswith('#')):i+=1
        body=[x for x in lines[start:i] if x.strip() and not x.lstrip().startswith('#')]
        ans[m[1]]='\n'.join(body)
    return ans
laws=blocks((s/'LAWS.bend').read_text(),'law');defs=blocks((s/'PROOF.bend').read_text(),'def')
selected={f'Laws.{id}' for id in ids};closure=set(selected)
while True:
    before=len(closure)
    for name in list(closure):
        for dep in defs:
            if dep not in closure and re.search(r'(?<![\w.])'+re.escape(dep)+r'\s*\(',defs[name]):closure.add(dep)
    if len(closure)==before:break
perlaw=[dict(law=r['law'],gdp_median_five_ms=r['ms'],bend_law_lines=len(laws[r['law']].splitlines()),bend_direct_proof_lines=len(defs['Laws.'+r['law']].splitlines())) for r in rows if r['n']]
gdp=[r['ms'] for r in rows if r['n']]
source_mutants=json.loads((s/'mutations.json').read_text())
source_selected=[r for r in source_mutants['rows'] if r['law'].split()[0] in ('O1','O4','O5','O6','O7','O10','O11','O12','O13')]
result=dict(method='Noncomment nonblank source declarations; selected 38 law declarations and 38 direct proof functions, then transitive local proof-helper closure. gdp physical laws.ts includes metadata, broken variants, eight extras, draw guidance; not normalized authoring effort.',per_law=perlaw,bend_selected_law_lines=sum(x['bend_law_lines'] for x in perlaw),bend_direct_proof_lines=sum(x['bend_direct_proof_lines'] for x in perlaw),bend_proof_with_local_helpers_lines=sum(len(defs[n].splitlines()) for n in closure),bend_local_helper_functions=sorted(closure-selected),files={str(p):file_count(p) for p in (s/'LAWS.bend',s/'PROOF.bend',Path(__file__).with_name('laws.ts'),Path(__file__).with_name('port.ts'))},gdp_proof_ms=dict(sum=sum(gdp),median=statistics.median(gdp),max=max(gdp)),source_bend_baseline=dict(receipt='pinned bend/ops_fsm/mutations.json',reference_proofs_check=source_mutants['rows'][0]['proofs_check'],selected_mutants=len(source_selected),selected_rejected=sum(r['proofs_check'] is False for r in source_selected),timing_available=False),timing_scope='gdp per-law median of five in process. No per-law Bend elapsed measurement in pinned receipt; do not infer a speedup. Whole-book fresh timing, if present in bend-timing.json, is not per-law timing.')
(o/'cost.json').write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items() if k not in ('files','per_law')}))
