"""Read-only independent Python oracle; private inputs arrive via fleet --input.
No production code is copied into this repository. Ledger IO is replaced only
for the stock replayer's pure O8 fixture path; never contact a real device.
"""
import importlib
import itertools
import json
from pathlib import Path
import random
import sys
import types

pkg = types.ModuleType('private_inputs')
pkg.__path__ = [str(Path('private_inputs').resolve())]
sys.modules['private_inputs'] = pkg
P = importlib.import_module('private_inputs.ops')
G = importlib.import_module('private_inputs.guard')
R = importlib.import_module('private_inputs.ops_replay')
G.ledger = lambda *a, **kw: None
K = ['healthy', 'bad', 'notified']
RK = ['active', 'interrupted', 'failed', 'done', 'resumed', 'reported']
EV = ['gw-restart', 'error', 'done', 'resume', 'report']
OUT = ['refused', 'deferred', 'promoted', 'rolled-back']
rows = []

def record(fn, x, scope):
    if fn == 'worktree':
        got = {'allowed': int(P.wt_allows(x['served'], P.GitOp(x['op']), x['txn']))}
    elif fn == 'rollout':
        got = {'out': OUT.index(P.rollout(P.Req(**{k: x[k] for k in ['clean','ff','gated','receipt','call','idle']}), x['check']).value)}
    elif fn == 'node':
        s = P.NSt(x['kind'], x['since'])
        a = P.nstep(s, x['ok'], x['now'], x['lim'])
        got = {'kind': K.index(a.kind), 'since': a.since, 'emit': int(P.neff(s, x['ok'], x['now'], x['lim']))}
    else:
        a = P.rstep(P.RSt(x['kind'], x['gw']), x['ev'], x['x'], x['session'])
        got = {'kind': RK.index(a.kind), 'gw': a.gw}
    rows.append({'fn': fn, 'input': x, 'expected': got, 'scope': scope})

for served, op, txn in itertools.product([False,True], P.GitOp, [False,True]):
    record('worktree',dict(served=served,op=op.value,txn=txn),'exhaustive-bools-enums')
for bits in itertools.product([False,True], repeat=7):
    record('rollout',dict(zip(['clean','ff','gated','receipt','call','idle','check'],bits)),'exhaustive-bools')
for kind, since, ok, now, lim in itertools.product(K,range(6),[False,True],range(6),range(6)):
    if kind == 'healthy' and since != 0: continue  # no payload in Bend NHealthy
    record('node',dict(kind=kind,since=since,ok=ok,now=now,lim=lim),'bounded-naturals-exhaustive-bools')
for kind, gw, ev, x, session in itertools.product(RK,range(6),EV,range(6),[False,True]):
    if kind not in ('active','interrupted') and gw != 0: continue # nullary Bend constructor
    record('restart',dict(kind=kind,gw=gw,ev=ev,x=x,session=session),'bounded-naturals-exhaustive-bools-enums')
rng=random.Random(20261025)
for _ in range(10000):
    kind=rng.choice(K);since=rng.randrange(2**32) if kind!='healthy' else 0;lim=rng.randrange(3601)
    now=max(0,since+lim+rng.choice([-1,0,1,rng.randrange(2**20)]))
    record('node',dict(kind=kind,since=since,ok=bool(rng.randrange(2)),now=now,lim=lim),'seeded-boundary')
    kind=rng.choice(RK);gw=rng.randrange(2**32) if kind in ('active','interrupted') else 0
    record('restart',dict(kind=kind,gw=gw,ev=rng.choice(EV),x=rng.choice([gw,rng.randrange(2**32)]),session=bool(rng.randrange(2))),'seeded')

replays=[]
for law in ['o2','o3','o8','o9']:
    t=json.loads(Path(f'{law}.json').read_text())
    out, summary=R.KINDS[t['kind']](t)
    replays.append({'law':law,'summary':summary,'rows':out})
    if law=='o2':
        for it in t['items']: record('worktree',dict(served=True,op=R._reflog_op(it['action']).value,txn=False),'tape-o2')
    elif law=='o3':
        for it in t['items']:
            record('rollout',{**it['req'],'check':it['check_kind']=='adb' and it['device_launch_result'].startswith('pass')},'tape-o3')
    elif law=='o8':
        s=P.NSt()
        for it in t['items']:
            record('node',dict(kind=s.kind,since=s.since,ok=it['healthy'],now=it['ts'],lim=t['limit_s']),'tape-o8')
            s=P.nstep(s,it['healthy'],it['ts'],t['limit_s'])
    else:
        for _unit in t['before']['units']:
            record('restart',dict(kind='active',gw=1,ev='gw-restart',x=1,session=False),'tape-o9')
Path('out/oracle.json').write_text(json.dumps({'seed':20261025,'rows':rows,'stock_replay':replays}))
print(json.dumps({'oracle_rows':len(rows),'stock_replay':[{k:v for k,v in r.items() if k!='rows'} for r in replays]}))
