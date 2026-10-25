# Generates private differential tapes on the MBP, importing the pinned twin verbatim.
# No production module is copied into git; source is a private fleet input.
import dataclasses as dc
import datetime as dt
import importlib.util
import json
import random
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location('ws_twin', 'inputs/worker_supervision.py')
f = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = f
spec.loader.exec_module(f)
HOSTS = list(f.Host)
EXCS = list(f.Exc)
PHASES = list(f.Phase)
EVENTS = ['Start','Beat','Spawn','Reap','Tick','Finish','Interrupt','Resume','Abandon','Integrate']
LIKELY = {'Dispatched':['Start']*5+['Interrupt','Abandon'], 'Running':['Beat','Spawn','Spawn','Reap','Tick','Finish','Interrupt'], 'Stalled':['Beat','Reap','Tick','Finish','Interrupt'], 'Interrupted':['Reap','Tick','Resume','Abandon'], 'Overdue':['Reap','Resume','Abandon'], 'Completed':['Reap','Integrate','Abandon']}

def obs(s):
    p=s.phase.value
    a={'phase':p}
    if p in ['Running','Stalled']:
        a.update(h=HOSTS.index(s.h),hb=s.hb,bg=s.bg)
    elif p in ['Interrupted','Overdue']:
        a.update(at=s.at,bg=s.bg)
    elif p=='Completed': a.update(bg=s.bg)
    elif p=='Resumed': a.update(by=s.by,bg=s.bg)
    return a

def encode(e):
    return dict(event=e.kind,host=HOSTS.index(e.h) if e.h is not None else 0,t=e.t,successor=e.by,log=e.log)

def tape(w,lim,initial,events):
    s=initial; steps=[]
    for e in events:
        s=f.step(s,e,lim)
        steps.append({'input':encode(e),'expected':obs(s)})
    return {'params':{'lim':lim,'heavy':w.load is f.Load.HEAVY,'exc':EXCS.index(w.exc)},'initial':obs(initial),'steps':steps}

def time(s):
    return int(dt.datetime.fromisoformat(s).timestamp()) if s else 0

def main():
    rng=random.Random(20261025)
    Path('out').mkdir(exist_ok=True)
    with open('out/oracle.jsonl','w') as out:
        def emit(x): out.write(json.dumps(x,separators=(',',':'))+'\n')
        for i in range(10000):
            w=f.W(i+1,rng.randrange(8),rng.choice(list(f.Load)),rng.choice(EXCS))
            lim=rng.choice([0,1,2,7,7200,86400]); s=f.St(f.Phase.DISPATCHED,w); initial=s; clock=0; events=[]
            for j in range(rng.randint(8,32)):
                k=rng.choice(LIKELY.get(s.phase.value,EVENTS) if rng.random()<0.85 else EVENTS)
                clock += rng.choice([0,1,lim,lim+1,lim*2+1])
                e=f.Ev(k,h=rng.choice(HOSTS),t=clock,by=rng.randrange(10),log=rng.random()<0.7)
                events.append(e); s=f.step(s,e,lim)
            emit({'kind':'worker','id':i,**tape(w,lim,initial,events)})
        # Arbitrary *valid tagged* observed states, not reachable-start-only tests.
        for i in range(1000):
            w=f.W(i+1,0,rng.choice(list(f.Load)),rng.choice(EXCS)); p=rng.choice(PHASES)
            kw={}
            if p.value in ['Running','Stalled']: kw=dict(h=rng.choice(HOSTS),hb=rng.randrange(20),bg=rng.randrange(5))
            elif p.value in ['Interrupted','Overdue']: kw=dict(at=rng.randrange(20),bg=rng.randrange(5))
            elif p.value=='Completed': kw=dict(bg=rng.randrange(5))
            elif p.value=='Resumed': kw=dict(by=rng.randrange(8),bg=rng.randrange(5))
            initial=f.St(p,w,**kw); es=[f.Ev(rng.choice(EVENTS),h=rng.choice(HOSTS),t=rng.randrange(50),by=rng.randrange(8),log=bool(rng.randrange(2))) for _ in range(12)]
            emit({'kind':'observed','id':i,**tape(w,rng.randrange(10),initial,es)})
        for i in range(2000):
            lease=f.Lease(); dev=f.Device(); ls=[]; ds=[]
            for j in range(16):
                op=rng.choice(['Acquire','Release','Reclaim']); a=rng.randrange(8); dead=bool(rng.randrange(2))
                lease=f.lstep(lease,op,a,dead);ls.append({'input':dict(op=op,a=a,dead=dead),'expected':{'holder':lease.holder}})
                op=rng.choice(['Lock','Unlock','Peek','Install','Input']);a=rng.randrange(8);app=rng.randrange(5)
                effect=f.peff(dev,op,a,app); dev=f.pstep(dev,op,a,app)
                ds.append({'input':dict(op=op,a=a,app=app),'expected':dict(holder=dev.lk.holder,fg=dev.fg,effect=list(effect))})
            emit({'kind':'lease','id':i,'steps':ls});emit({'kind':'device','id':i,'steps':ds})
        for name in ['worker-supervision-20261021.json','worker-supervision-20261021-after-apply.json']:
            d=json.loads((Path('inputs')/name).read_text());lim=int(d['limit_hours']*3600)
            for i,record in enumerate(d['workers']):
                w=f.W(i+1);initial=f.St(f.Phase.DISPATCHED,w)
                # The serialized evidence omits host and successor. Recover fixed host from supervise.py:964;
                # successor only affects the id carried by Resumed, never the phase. Explicitly mark this gap.
                es=[f.Ev(e['kind'],h=f.Host.GROOT,t=time(e.get('t')),by=i+1,log=e.get('log',False)) for e in record['events']]
                emit({'kind':'real','snapshot':name,'id':record['id'],'record':record,**tape(w,lim,initial,es)})
    print(json.dumps({'seed':20261025,'worker_sequences':10000,'observed_sequences':1000,'lease_sequences':2000,'device_sequences':2000,'oracle':'pinned worker_supervision.py, per-step canonical tagged state and emitted effects'}))

if __name__=='__main__': main()
