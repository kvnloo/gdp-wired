"""MBP-only comparison; preserve failures, never invent Bend timings.

Whole family command median / law count is an amortized cost, NOT an isolated
per-law measurement. CPU clock/native checker is not GPU execution throughput.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import statistics
import subprocess
import time


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', type=Path, required=True)
    ap.add_argument('--battery', type=Path, required=True)
    ap.add_argument('--out', type=Path, required=True)
    args = ap.parse_args()
    battery = json.loads(args.battery.read_text())
    bend = shutil.which('bend') or str(Path.home() / '.bend/bin/bend')
    families = []
    for name in ('root_cause_fsm', 'artifact_lease_fsm', 'placement_fsm'):
        directory = args.source / 'bend' / name
        laws = sum(line.startswith('law ') for line in (directory / 'LAWS.bend').read_text().splitlines())
        lines = {f: len((directory / f).read_text().splitlines()) for f in ('LAWS.bend', 'PROOF.bend')}
        runs = []
        for _ in range(3):
            t = time.perf_counter()
            try:
                p = subprocess.run([bend, 'PROOF.bend'], cwd=directory, text=True, capture_output=True, timeout=180)
                run = dict(ms=(time.perf_counter()-t)*1000, returncode=p.returncode, output=p.stdout+p.stderr, proofs_check=p.returncode == 0 and 'ALL PROOFS CHECK' in p.stdout+p.stderr)
            except (OSError, subprocess.TimeoutExpired) as e:
                run = dict(ms=(time.perf_counter()-t)*1000, proofs_check=False, error=str(e))
            runs.append(run)
            if not run['proofs_check']:
                break
        median = statistics.median(r['ms'] for r in runs) if all(r['proofs_check'] for r in runs) else None
        verdict_start = time.perf_counter()
        env = {**os.environ, 'PATH': '/usr/bin:' + os.environ.get('PATH', '') + ':' + str(Path.home() / '.elan/bin')}
        try:
            p = subprocess.run([bend, 'PROOF.bend', '--verdict'], cwd=directory, text=True, capture_output=True, timeout=180, env=env)
            verdict = dict(ms=(time.perf_counter()-verdict_start)*1000, returncode=p.returncode, output=p.stdout+p.stderr, proofs_check=p.returncode == 0 and 'ALL PROOFS CHECK' in p.stdout+p.stderr)
        except (OSError, subprocess.TimeoutExpired) as e:
            verdict = dict(ms=(time.perf_counter()-verdict_start)*1000, proofs_check=False, error=str(e))
        gdp_runs = []
        for _ in range(3):
            gdp_start = time.perf_counter()
            p = subprocess.run(['bun', 'z0/control-root-cause/prove.ts', '--family', name], text=True, capture_output=True, timeout=180)
            payload = json.loads(p.stdout) if p.returncode == 0 else None
            gdp_runs.append(dict(ms=(time.perf_counter()-gdp_start)*1000, returncode=p.returncode, all_checked=bool(payload and payload['all_checked']), output=p.stdout+p.stderr))
        gdp_median = statistics.median(r['ms'] for r in gdp_runs) if all(r['all_checked'] for r in gdp_runs) else None
        families.append(dict(family=name, laws=laws, lines=lines, runs=runs, median_ms=median, amortized_ms_per_law=median/laws if median is not None else None, verdict=verdict, gdp_runs=gdp_runs, gdp_command_median_ms=gdp_median, gdp_command_amortized_ms_per_law=gdp_median/laws if gdp_median is not None else None))
    gdp_lines = len(Path('z0/control-root-cause/laws.ts').read_text().splitlines())
    gdp_times = [r['ms'] for r in battery['rows'] if r['n'] > 0]
    result = dict(families=families, bend=str(bend), gdp_laws_ts_lines=gdp_lines,
                  bend_laws_plus_proof_lines=sum(sum(f['lines'].values()) for f in families),
                  gdp_proof_median_ms_per_law=statistics.median(gdp_times), gdp_proof_sum_ms=sum(gdp_times),
                  gdp_battery_ms=battery['totalMs'],
                  limitations=['Bend and GDP whole-process proof-only command medians each include startup. Separate GDP per-law timings are warm in-process medians of five.',
                               'Bend cost is remeasured here; historical per-law timing receipts were not located in the assigned evidence directories.',
                               'This is not a GPU runtime benchmark or a billable-token comparison. A separate --verdict command is timed once per family, with failure preserved.',
                               'laws.ts includes metadata, helpers and extras; line counts are physical lines, not normalized source complexity.'])
    args.out.write_text(json.dumps(result, indent=2))
    print(json.dumps(result))


if __name__ == '__main__':
    main()
