# O2/O3/O8/O9 critic port

Pinned specification: `sqlite-store-laws@d2e34614638059b38da77fd5f0bb582af500a503`.
This directory contains code and synthetic counterexample runs only. Private incident tapes,
Python source snapshots and generated results are fleet inputs / external artifacts, never git data.

- `port.ts`: exact finite decision ports plus explicit composed process models.
- `laws.ts`: the 19 original Bend names/order, four run-level safety extras, stronger incident
  outcome probes and generalizations. Stronger probes are not substituted for the original laws.
- `run.ts --json OUT [--strict]`: triple-check battery and per-rule from-any verdict.
- `critic.ts`: original mutant kill matrix; generated constant/omitted state-write mutants;
  structural chart checks; invariant searches; stronger claims with checked breaking runs.
- `oracle.py`: reads actual pinned Python modules supplied externally; exhaustive Boolean/enum
  domains, bounded natural grid, seeded natural boundary inputs and the four stock replay adapters.
- `parity.ts`: compares those oracle rows and tests intentional local sabotage.
- `replay.ts`: watches the process runs using `core/watch.ts`, compares O8 state/payload/emissions
  at every probe and O9 worker outcomes, preserves historical-vs-counterfactual differences.

## Execution

All proof, battery, parity, replay and typecheck commands must run on the MBP:

```sh
fleet-build --node mbp --mem 2G --cpus 1 --wait 1800 --timeout 1800 \
  --src /mnt/zer0models/z0-wt/gdpw-ops-stateful \
  --fetch out --out RESULTS -- bash -lc \
  'bun install --frozen-lockfile >/dev/null; mkdir -p out; bun z0/ops-stateful/run.ts --strict --json out/battery.json; bun z0/ops-stateful/critic.ts'
```

For parity/replay, additionally pass private inputs via `--input FILE:NAME`: `o2.json`,
`o3.json`, `o8.json`, `o9.json` and `private-inputs.tar` containing the unmodified pinned
`ops.py`, `guard.py`, `phone_caps.py`, `ops_replay.py` under `private_inputs/`.
Inside the job, unpack it, create an isolated Python venv, install **PyYAML==6.0.3**
(required by guard's unrelated phone_caps import), then run:

```sh
.oracle-venv/bin/python z0/ops-stateful/oracle.py
bun z0/ops-stateful/parity.ts
bun z0/ops-stateful/replay.ts
bun node_modules/typescript/bin/tsc --noEmit -p z0/ops-stateful/tsconfig.json
```

The Python stock replayer's ledger writer is replaced with a no-op to prevent private host
writes. Its decision functions, classifications and state transitions are not replaced.
No physical service, worktree, gateway or device is touched by any test.

## Proof boundary

Bits/enums/natural arithmetic are exact within gdp-wired's runtime safe-natural range.
Nullary Bend constructors have canonical zero payloads; arbitrary malformed Python dataclass
payloads are outside that equivalence claim. Revision and gateway identities are opaque IDs.
The process models compose the ported decisions with explicit state; they are **not extracted
or proven equivalent to guard.py's IO**. Reset success, delivery, scheduling and identity checks
are external inputs. Charts are structural shadows, not complete guarded process models.

The critic distinguishes actual outcome weaknesses (a failed reset still reported rolled-back;
a failed notice delivery consumed permanently) from deliberate abstraction boundaries and
unjustified deadline probes. A refuted two-step progress claim is not a refuted Bend law.
Automatic mutant survivors are not called equivalent: without equivalence classification no
non-equivalent-mutant percentage is reported.
