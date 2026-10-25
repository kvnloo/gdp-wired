"""Private oracle generator; run on MBP, input archive is never committed.
ops.py is the production oracle. O11/O12 has no scalar twin; the independent
Bend transcription below is explicitly labelled a limited oracle, not ops.py parity.
"""
import argparse, hashlib, importlib, itertools as I, json, os, runpy, sys, tempfile, types
from pathlib import Path

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--source',required=True);ap.add_argument('--out',required=True);a=ap.parse_args()
    root=Path(a.source);out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
    sys.path.insert(0,str(root/'src'))
    from z0int.fsm import ops as P, guard as G
    counts={};rows=0;groups=[]
    dest=(out/'cases.jsonl').open('w')
    def put(family,inp,expected,origin='parity',**extra):
        nonlocal rows
        row={'family':family,'input':inp,'expected':expected,'origin':origin,**extra}
        dest.write(json.dumps(row,separators=(',',':'))+'\n');rows+=1;counts[origin+':'+family]=counts.get(origin+':'+family,0)+1
    def place(l): return {None:0,P.Lane.GROOT:1,P.Lane.MBP:2,P.Lane.PHONE:3}[l]
    B=(False,True)
    for c,l,m,p in I.product(P.Cls,P.Lane,B,B):
        put('placement',dict(cls=c.value,lane=l.value,m=m,p=p),dict(admits=int(P.admits(l,c)),place=place(P.place(c,m,p))))
    for pr,v in I.product(B,P.Vis):put('privacy',dict(private=pr,vis=v.value),dict(ok=int(P.push_allows(pr,v))))
    for k,intent,fg,chain,call in I.product(P.PKind,B,B,B,B):
        put('phone',dict(kind=k.value,intent=intent,fg=fg,chain=chain,call=call),dict(ok=int(P.phone_allows(k,intent=intent,fg=fg,chain=chain,call=call))))
    for cancelled,sol,design in I.product(B,repeat=3):put('routing',dict(cancelled=cancelled,sol=sol,design=design),dict(ok=int(P.route_ok(cancelled,sol,design))))
    for ready,memory,cpu,battery,thermal in I.product(B,repeat=5):
        put('resources',dict(ready=ready,memory=memory,cpu=cpu,battery=battery,thermal=thermal),dict(ok=int(P.phone_admits(ready,memory,cpu,battery,thermal)),place=place(P.phone_place(ready,memory,cpu,battery,thermal))))
    # All ordered lists length <=3 over 3 names, including duplicates and all orderings.
    lists=[list(t) for n in range(4) for t in I.product(range(3),repeat=n)]
    for pre,post,rm in I.product(lists,repeat=3):
        put('accessibility',dict(Pre=pre,Post=post,Rm=rm,x=0,first=pre[0] if pre else 0),dict(ok=int(P.a11y_ok(pre,post,rm))))
    # Dense integer box, plus sparse boundaries. Identity comparisons use complete equality representatives.
    vals=list(range(33))+[118,119,120,2**32-1,2**32,2**32+1]
    for credited,actual,named,measured,count,risk in I.product(B,range(3),range(3),vals,vals,range(6)):
        put('capacity',dict(credited=credited,actual=actual,named=named,measured=measured,count=count,risk=risk),dict(limit=P.option_limit(credited,actual,named,measured),ok=int(P.option_capacity_allows(credited,actual,named,measured,count)),risk=int(P.option_risk_allows(risk)),risk_ok=int(P.risk_option_capacity_allows(risk,credited,actual,named,measured,count))))
    for family,named_family,stage,named_arm,arm,offload,healthy,abstain in I.product(range(2),range(2),('none','shadow','canary','live'),range(2),range(2),B,B,B):
        credited=stage in ('canary','live')
        ok=(family==named_family and credited and arm==named_arm) if offload else (family!=named_family or stage!='live' or not healthy or abstain)
        put('policy',dict(family=family,named_family=named_family,stage=stage,named_arm=named_arm,arm=arm,offload=offload,healthy=healthy,abstain=abstain),dict(credited=int(credited),ok=int(ok)),oracle='limited independent Bend transcription; no scalar ops.py twin')
    tape_dir=root/'tests/fixtures/ops_tapes'
    names=['o1-groot-heavy-20261021.json','o4-taste-data-20261021.json','o5-phone-tap-20261021.json','o6-a11y-reinstall-20261021.json','o7-routing-20261021.json']
    temp_root=out/'private-tmp';temp_root.mkdir(exist_ok=True)
    for name in names:
        tape=json.loads((tape_dir/name).read_text());law=tape['law'];group={'tape':name,'law':law,'sha256':hashlib.sha256((tape_dir/name).read_bytes()).hexdigest(),'items':0,'oracle_expectations_ok':True,'abstract_rows':0}
        if law=='O1':
            for i,it in enumerate(tape['items']):
                c=P.classify_command(it['cmd']);group['items']+=1
                if c is None:
                    group.setdefault('unclassified',[]).append(i);continue
                put('placement',dict(cls=c.value,lane='groot',m=tape['mbp_room'],p=tape['phone_room']),dict(admits=int(P.admits(P.Lane.GROOT,c)),place=place(P.place(c,tape['mbp_room'],tape['phone_room']))),'replay',tape=name,index=i)
                group['abstract_rows']+=1
            group['oracle_expectations_ok']=group['abstract_rows']>0
        elif law=='O4':
            # Frozen incident identities, not live GitHub queries; no network or push.
            visibility={'kvnloo/taste-data':P.Vis.PRIVATE,'kvnloo/taste-skill':P.Vis.PUBLIC}
            old_remote_vis=G.remote_vis;old_verdict=G.verdict;old_push=P.push_allows
            G.remote_vis=lambda url:visibility.get(G.remote_slug(url),P.Vis.UNKNOWN)
            G.verdict=lambda _gate,bad,_rec,**kw:1 if bad else 0
            G.private_globs=lambda:[]
            def git(d,*args):
                import subprocess
                return subprocess.run(['git','-C',str(d),*args],check=True,capture_output=True,text=True).stdout.strip()
            try:
                for i,it in enumerate(tape['items']):
                    seen=[]
                    def record(pr,v):seen.append((pr,v));return old_push(pr,v)
                    P.push_allows=record
                    with tempfile.TemporaryDirectory(dir=temp_root) as d:
                        git(d,'init','-q','-b','main');git(d,'config','user.name','synthetic-replay');git(d,'config','user.email','replay@localhost');git(d,'remote','add','origin',it['origin_url'])
                        remote='origin'
                        if it['remote_url']!=it['origin_url']:remote='public';git(d,'remote','add',remote,it['remote_url'])
                        for rel,body in it['files'].items():p=Path(d)/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(body)
                        git(d,'add','-A');git(d,'commit','-qm','private replay fixture');sha=git(d,'rev-parse','HEAD')
                        code=G.prepush(remote,it['remote_url'],f'refs/heads/main {sha} refs/heads/main {G.ZERO}\n',d)
                    outcome='refused' if code else 'allowed';group['oracle_expectations_ok'] &= outcome==it['expect'];group['items']+=1
                    for pr,v in seen:put('privacy',dict(private=pr,vis=v.value),dict(ok=int(old_push(pr,v))),'replay',tape=name,index=i,expect=it['expect']);group['abstract_rows']+=1
            finally:G.remote_vis=old_remote_vis;G.verdict=old_verdict;P.push_allows=old_push
            group['visibility_assumption']='Frozen named repositories from tape incident; live GH visibility and glob config not proven.'
        elif law=='O5':
            for i,it in enumerate(tape['items']):
                d=G.phone_decision(it['kind'],utterance=it.get('utterance'),expected_app=it.get('expected_app'),foreground_app=it.get('foreground_app'),package=it.get('package'),call=it.get('call',True))
                put('phone',dict(kind=d['kind'],intent=d['intent'],fg=d['fg_expected'],chain=d['chain'],call=d['call_live']),dict(ok=int(d['allowed'])),'replay',tape=name,index=i,expect=it['expect'])
                group['items']+=1;group['abstract_rows']+=1;group['oracle_expectations_ok'] &= ('allowed' if d['allowed'] else 'refused')==it['expect']
        elif law=='O6':
            for i,it in enumerate(tape['items']):
                pre,post,rm=(P.parse_a11y(it[k]) for k in ('pre','post','removed'));ids={s:j for j,s in enumerate(sorted(set(pre+post+rm)))}
                pre,post,rm=([ids[s] for s in ss] for ss in (pre,post,rm));ok=P.a11y_ok(pre,post,rm)
                put('accessibility',dict(Pre=pre,Post=post,Rm=rm,x=0,first=pre[0] if pre else 0),dict(ok=int(ok)),'replay',tape=name,index=i,expect=it['expect'])
                group['items']+=1;group['abstract_rows']+=1;group['oracle_expectations_ok'] &= ('allowed' if ok else 'refused')==it['expect']
            group['source_limit']='Includes explicitly reconstructed One UI post-install behavior, not all fresh observations.'
        else:
            # routing_findings consumes JSON-written YAML fixtures. A narrow JSON loader avoids installing PyYAML;
            # actual YAML parsing is not under test. The unmodified walk/classifier code is exercised.
            sys.modules['yaml']=types.SimpleNamespace(safe_load=json.loads,YAMLError=ValueError)
            old_route=P.route_ok;seen=[]
            def record(cancelled,sol,design):seen.append((cancelled,sol,design));return old_route(cancelled,sol,design)
            try:
                P.route_ok=record
                for i,cfg in enumerate(tape['configs']):
                    seen.clear()
                    with tempfile.TemporaryDirectory(dir=temp_root) as d:
                        path=Path(d)/'omp.yml';path.write_text(json.dumps(cfg['omp_excerpt']));findings=G.routing_findings(path,[],Path(d)/'none.yml')
                    group['items']+=1;group['oracle_expectations_ok'] &= bool(findings)==(cfg['expect']=='flagged')
                    for j,(cancelled,sol,design) in enumerate(seen):put('routing',dict(cancelled=cancelled,sol=sol,design=design),dict(ok=int(old_route(cancelled,sol,design))),'replay',tape=name,index=f'config-{i}-{j}');group['abstract_rows']+=1
            finally:P.route_ok=old_route
            for i,it in enumerate(tape['items']):
                cancelled,sol=P.provider_flags(None,it['model']);design=P.design_role(it['role']);ok=P.route_ok(cancelled,sol,design)
                put('routing',dict(cancelled=cancelled,sol=sol,design=design),dict(ok=int(ok)),'replay',tape=name,index=i,expect=it['expect'])
                group['items']+=1;group['abstract_rows']+=1;group['oracle_expectations_ok'] &= ('allowed' if ok else 'refused')==it['expect']
            group['parser_limit']='JSON fixture via narrow yaml.safe_load=json.loads test shim; no claim about actual YAML parsing.'
        groups.append(group)
    dest.close()
    mutations=runpy.run_path(str(root/'bend/ops_fsm/mutations.py'))['MUTATIONS'];selected=[]
    for i,(law,desc,old,new) in enumerate(mutations,1):
        if law.split()[0] in ('O1','O4','O5','O6','O7','O10','O11','O12','O13'):selected.append(dict(id=i,law=law.split()[1],description=desc))
    (out/'source-mutants.json').write_text(json.dumps(selected,indent=2))
    hashes={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(root.rglob('*')) if p.is_file() and '__pycache__' not in str(p)}
    metadata=dict(counts=counts,rows=rows,replay_groups=groups,source_hashes=hashes,seed=None,method='exhaustive finite table products, lists <=3 over 3 names, capacity credit x scope 0..2 x measured/count [0..32,118,119,120,2^32-1,2^32,2^32+1] x risk 0..5; O11/O12 equality quotient 0/1 independent limited Bend oracle')
    (out/'oracle-metadata.json').write_text(json.dumps(metadata,indent=2));print(json.dumps({k:v for k,v in metadata.items() if k!='source_hashes'}))
if __name__=='__main__':main()
