"""Pure reference calls only. Never invoke scan_holders/auth_count/sqlite_receipt.
Source files are supplied privately; no databases, owner tape, or histories in git.
"""
import argparse
import hashlib
import importlib.util
import itertools as it
import json
from pathlib import Path
import random
import sys
import types


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def emit(group, inputs, expected, **extra):
    sys.stdout.write(json.dumps(dict(group=group, input=inputs, expected=expected, **extra), separators=(",", ":")) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ops', default='oracle_ops.py')
    ap.add_argument('--guard', default='oracle_guard.py')
    ap.add_argument('--tape')
    args = ap.parse_args()
    pkg = types.ModuleType('oracle'); pkg.__path__ = []
    sys.modules['oracle'] = pkg
    p = load('oracle.ops', args.ops)
    s = load('oracle.sqlite_guard', args.guard)
    # Fail hard if a future change accidentally calls any observational path.
    def forbidden(*_a, **_kw):
        raise AssertionError('IO observation is forbidden in this pure oracle')
    s.scan_holders = s.auth_count = s.sqlite_receipt = s.identity = s.baseline_count = forbidden
    s.sqlite3.connect = forbidden
    if args.tape:
        tape = json.loads(Path(args.tape).read_text())
        for index, item in enumerate(tape['items']):
            emit('tape', item['inputs'], s.sqlite_decision(**item['inputs']), index=index,
                 label=item['label'], expected_laws=item['expect'])
        return
    for complete, empty in it.product((False, True), repeat=2):
        emit('ops.replace', dict(complete=complete, empty=empty), {'ok': int(p.sqlite_replace_allows(complete, empty))})
    for complete, ghosts in it.product((False, True), repeat=2):
        emit('ops.holders', dict(complete=complete, ghosts=ghosts), {'ok': int(p.sqlite_holders_ok(complete, ghosts))})
    for current in (False, True):
        emit('ops.sidecar', dict(current=current), {'ok': int(p.sqlite_sidecar_allows(current))})
    for known, before, after in it.product((False, True), range(11), range(11)):
        emit('ops.auth.bounded', dict(known=known, before=before, after=after), {'ok': int(p.sqlite_auth_ok(known, before, after))})
    rng = random.Random(16016)
    for _ in range(1000):
        known, before, after = rng.choice((False, True)), rng.randrange(2**40), rng.randrange(2**40)
        emit('ops.auth.seeded', dict(known=known, before=before, after=after), {'ok': int(p.sqlite_auth_ok(known, before, after))})
    edges = (0, 1, 9, 10, 65536, 4294967295, 9007199254740990)
    for known, before, after in it.product((False, True), edges, edges):
        emit('ops.auth.edges', dict(known=known, before=before, after=after), {'ok': int(p.sqlite_auth_ok(known, before, after))})
    universe = [dict(pid=pid, path=path, ghost=ghost)
                for pid, path, ghost in it.product((1, 2), ('/store', '/store-wal', '/store-shm', '/other'), (False, True))]
    holder_lists = [[]] + [[h] for h in universe] + [list(hs) for hs in it.product(universe, repeat=2)]
    operations = ('inspect', 'replace', 'unlink', 'recreate', 'remove-sidecars', 'other')
    for complete, hs, before, after, op, actor in it.product((False, True), holder_lists, (None, 0, 1, 9, 10),
                                                          (None, 0, 1, 9, 10), operations, (None, 0, 1, 2, 3)):
        inputs = dict(complete=complete, holders=hs, before=before, after=after, operation=op, actor_pid=actor, db='/store')
        emit('guard.finite', inputs, s.sqlite_decision(**inputs))
    for _ in range(1000):
        inputs = dict(complete=rng.choice((False, True)), holders=[rng.choice(universe) for _ in range(rng.randrange(13))],
                      before=rng.choice((None, 0, 1, 9, 10)), after=rng.choice((None, 0, 1, 9, 10)),
                      operation=rng.choice(operations), actor_pid=rng.choice((None, 0, 1, 2, 3)), db='/store')
        emit('guard.seeded', inputs, s.sqlite_decision(**inputs))


if __name__ == '__main__':
    main()
