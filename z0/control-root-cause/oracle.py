"""MBP-only: execute the pinned Python twins, not a reimplementation of them.

Twins and private observations are job inputs; only this generic driver is committed.
"""
import argparse
import hashlib
import importlib.util
import itertools
import json
from pathlib import Path
import random
import time

FIELDS = {'r1': ('target', 'before_metric', 'functional_probe', 'expiry_valid'),
          'r2': ('same_metric', 'in_bounds_twice', 'separated_24h'),
          'r3': ('probe_failed', 'owned', 'leased'),
          'r4': ('same_window', 'share_at_least_30'),
          'r7': ('report_only', 'same_finding', 'age_expired')}
LEASE = ('expired', 'allowlisted', 'known_nonlive', 'no_symlink', 'archive_ready')
MISSING = object()
INVALID = (None, 0, 1, 'true', 'false', [], {}, 0.0)
CODES = {'unknown': 0, 'pass': 1, 'violation': 2, 'escalate': 0, 'allow': 1, 'refuse': 2, 'rollback': 3}


def load(path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def enc(value):
    return 'true' if value is True else 'false' if value is False else 'absent'


def cases(names):
    for values in itertools.product((MISSING, False, True), repeat=len(names)):
        yield {k: v for k, v in zip(names, values) if v is not MISSING}, 'finite'
    for name in names:
        sibling = next(k for k in names if k != name)
        for invalid, other_false in itertools.product(INVALID, (False, True)):
            row = dict.fromkeys(names, True)
            row[name] = invalid
            if other_false:
                row[sibling] = False
            yield row, 'invalid'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--twins', type=Path, required=True)
    ap.add_argument('--out', type=Path, required=True)
    args = ap.parse_args()
    t = time.perf_counter()
    base = args.twins / 'src/z0int/fsm'
    R, C, G, H = [load(base / (n + '.py')) for n in ('root_cause', 'root_canaries', 'artifact_leases', 'cgroup_placement')]
    rows = []
    for name, names in FIELDS.items():
        raw = ((dict(zip(names, vs)), 'finite') for vs in itertools.product((False, True), repeat=3)) if name == 'r7' else cases(names)
        for facts, domain in raw:
            if name == 'r7':
                status = 'pass' if C.report_only_expired(facts['report_only'], facts['same_finding'], 259200 if facts['age_expired'] else 259199) else 'violation'
            elif name == 'r3':
                actual = dict(facts)
                failed = actual.pop('probe_failed', MISSING)
                if type(failed) is bool:
                    actual['probe_passed'] = not failed
                status = R.r3(actual)
            else:
                status = getattr(R, name)(facts)
            rows.append(dict(group=name, domain=domain, input={k: enc(facts.get(k)) for k in names}, expected=CODES[status], raw=facts))
    for facts, domain in cases(LEASE):
        rows.append(dict(group='lease', domain=domain, input={k: enc(facts.get(k)) for k in LEASE}, expected=CODES[G.evaluate(facts)], raw=facts))
    for facts, domain in cases(('available', 'agent', 'scoped')):
        rows.append(dict(group='placement', domain=domain, input={k: enc(facts.get(k)) for k in ('available', 'agent', 'scoped')}, expected=CODES[H.decide(facts.get('available'), facts.get('agent'), facts.get('scoped'))], raw=facts))
    for report, same, seconds in itertools.product((False, True), (False, True), (-1, 0, 259199, 259200, 259201, 518400)):
        rows.append(dict(group='r7_boundary', domain='boundary', input={'report_only': enc(report), 'same_finding': enc(same), 'age_expired': enc(seconds >= C.EXPIRY)}, expected=int(bool(C.report_only_expired(report, same, seconds))), seconds=seconds))
    rng = random.Random(20261025)
    for _ in range(1000):
        created, ttl = rng.randrange(100000), rng.randrange(1, 100000)
        now = created + ttl + rng.choice((-1, 0, 1))
        flags = {k: bool(rng.randrange(2)) for k in LEASE if k != 'expired'}
        facts = {'expired': now >= created + ttl, **flags}
        rows.append(dict(group='lease_boundary', domain='seeded boundary', input={'created': created, 'ttl': ttl, 'now': now, **flags}, expected=int(G.evaluate(facts) == 'pass')))
    # Run the original incident fixture's adapter while observing the actual r2 call.
    fixture = json.loads((args.twins / 'tests/fixtures/root-cause-incident.json').read_text())
    capture = []
    original = R.r2
    def tapped(facts):
        capture.append(dict(facts))
        return original(facts)
    R.r2 = tapped
    prefixes = []
    for n in range(len(fixture['observations']) + 1):
        status = R.close_decision({**fixture, 'observations': fixture['observations'][:n]})
        prefixes.append(dict(group='r2', input={k: enc(capture[-1].get(k)) for k in FIELDS['r2']}, expected=CODES[status], prefix=n))
    R.r2 = original
    # Private reaper reports are NOT Law G input records. Do not fabricate missing
    # expired/allowlist/symlink/archive observations from a historic eligible bit.
    histories = []
    for p in sorted((args.twins / 'histories').glob('*.json')):
        obj = json.loads(p.read_text())
        candidates = list(obj.get('items', [])) + list(obj.get('guest', {}).get('items', []))
        histories.append(dict(file=p.name, rows=len(candidates), complete_law_g_rows=sum(all(k in row for k in LEASE) for row in candidates), historical_eligible=sum(row.get('eligible') is True for row in candidates), error_record='error' in obj))
    manifest = {str(p.relative_to(args.twins)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(base.glob('*.py'))}
    args.out.write_text(json.dumps(dict(rows=rows, fixture_prefixes=prefixes, histories=histories, source_sha256=manifest, seed=20261025, python_ms=(time.perf_counter()-t)*1000), indent=2))
    print(json.dumps(dict(oracle_rows=len(rows), fixture_prefixes=len(prefixes), histories=histories, python_ms=(time.perf_counter()-t)*1000)))


if __name__ == '__main__':
    main()
