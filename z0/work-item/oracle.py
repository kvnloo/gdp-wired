"""Independent pinned Python twin oracle. Run on MBP, never writes private data to git."""
import argparse, importlib.util, sys, json, random
p=argparse.ArgumentParser();p.add_argument('--twin',required=True);p.add_argument('--history',required=True);p.add_argument('--out',required=True);a=p.parse_args()
spec=importlib.util.spec_from_file_location('work_item_twin',a.twin);m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
roles=list(m.Role);kinds=list(m.EVENT_KINDS);ids={};shas={}
def intern(d,x):
 if x is None:return 0
 if x not in d:d[x]=len(d)+1
 return d[x]
def event(d):
 ar=d.get('actor');r=d.get('receipt')
 return m.Event(d['kind'],m.Actor(ar['id'],m.Role(ar['role'])) if ar else None,d.get('sha'),m.Receipt(r.get('sha'),r['passed']) if r else None)
def encoded(d):
 ar=d.get('actor');r=d.get('receipt')
 return dict(ev=kinds.index(d['kind']),actor=intern(ids,ar['id']) if ar else 0,role=roles.index(m.Role(ar['role'])) if ar else 3,sha=intern(shas,d.get('sha')),rsha=intern(shas,r.get('sha')) if r else 0,passed=r['passed'] if r else False)
def state(s):
 o={'phase':s.phase.value};n=list(m.Phase).index(s.phase)
 if n not in (0,11):o['au']={'id':intern(ids,s.au.id),'role':s.au.role.value}
 if n not in (0,1,11):o['hd']=intern(shas,s.hd)
 if n in (5,6,7,8):o['ig']=intern(shas,s.ig)
 if n==6:o['dp']=intern(shas,s.dp)
 if n in (7,8):o['ap']={'id':intern(ids,s.ap.id),'role':s.ap.role.value}
 return o
def tape(ds,id,kind,meta=None):
 s=m.Item();expected=[];encoded_events=[];refused=[]
 for i,d in enumerate(ds):
  e=event(d);encoded_events.append(encoded(d));refused.append(m.refused(s,e));s=m.step(s,e);expected.append(state(s))
 return dict(id=id,kind=kind,events=encoded_events,expected=expected,refused=refused,meta=meta)
rng=random.Random(20261025)
def ev(k,who='a',role='sol',sha=None,rsha=None,passed=False):return dict(kind=k,actor=dict(id=who,role=role) if who else None,sha=sha,receipt=dict(sha=rsha,passed=passed) if rsha is not None else None)
happy=[ev('Claim'),ev('Start'),ev('Push',sha='h1'),ev('Submit'),ev('Verify','ci','ci',rsha='h1',passed=True),ev('Integrate','op','opus','h2','h2',True),ev('Deploy','ci','ci','h2'),ev('Accept','owner','owner'),ev('Merge','ci','ci')]
def random_ev():
 return ev(rng.choice(kinds),rng.choice(['a','b','ci','owner']),rng.choice([r.value for r in roles]),rng.choice(['h1','h2','h3','h4','h5']),rng.choice(['h1','h2','h3','h4','h5']),bool(rng.randrange(2)))
with open(a.out,'w') as f:
 for i in range(10000):
  ds=[random_ev() for _ in range(rng.randrange(1,49))]
  if i%2==0:
   ds=happy[:rng.randrange(1,10)]+ds[:rng.randrange(0,25)]
   if i%4==0:ds=happy+[ev('Interrupt',None),ev('Resume','b','opus')]+ds[:12]
  f.write(json.dumps(tape(ds,str(i),'seeded'))+'\n')
 # Boundary probes are separate from the registered 10,000-tape domain, never normalized away.
 for label,ds in [('drift_after_acceptance',happy[:8]+[ev('Observe',None,sha='h3'),ev('Merge','ci','ci')]),('empty_head_receipt',[ev('Claim'),ev('Start'),ev('Submit'),dict(kind='Verify',actor=dict(id='ci',role='ci'),sha=None,receipt=dict(sha=None,passed=True))])]:
  f.write(json.dumps(tape(ds,label,'boundary'))+'\n')
 history=json.load(open(a.history))
 for item in history['items']:f.write(json.dumps(tape(item['events'],item['id'],'real',item))+'\n')
print(json.dumps(dict(seed=20261025,seeded_tapes=10000,real_items=len(history['items']),max_tape_length=48,comparison='every step; canonical Bend constructor fields; None head -> 0; strings interned injectively')))
