# O16 SQLite store lifecycle critic

Pinned input: `sqlite-store-laws@d2e34614638059b38da77fd5f0bb582af500a503`.
No files in that checkout are changed. No database operations are part of this port.

## Reproduce on the MBP

Use `fleet-build --node mbp --mem 2G --cpus 1 --wait 1800 --timeout 1800
--src /mnt/zer0models/z0-wt/gdpw-ops-sqlite` and fetch the requested output files.
Inside a job:

```sh
bun install --frozen-lockfile
mkdir -p out
bun z0/ops-sqlite/run.ts --json out/battery.json --strict
bun z0/ops-sqlite/parity.ts --ops oracle_ops.py --guard oracle_guard.py --json out/parity.json
bun z0/ops-sqlite/parity.ts --ops oracle_ops.py --guard oracle_guard.py --tape private_tape.json --json out/replay.json
```

For parity/replay supply `src/z0int/fsm/ops.py:oracle_ops.py`,
`src/z0int/fsm/sqlite_guard.py:oracle_guard.py`, and
`tests/fixtures/ops_tapes/o16-sqlite-store.json:private_tape.json` from the pinned
checkout as `--input` arguments. Do not commit these inputs or fetched results.
Results are private under `data/operations/gdp-wired-laws/ops-sqlite/` outside this
worktree. No real store is ever opened, copied, locked, queried, or repaired.

## What is exact

`port.ts` mirrors the four Bend/Python Bool/Nat decisions. `laws.ts` states all
11 O16 Bend laws, in source order, with no weakened premise or changed constant.
Each has the corresponding type-preserving source mutant. The runner checks
kernel acceptance, concrete draws/runs, compiled/interpreter agreement, builder
cross-checks, concrete broken variants and the complete original mutant kill
matrix. Two recursive auth mutants test suite completeness beyond the supplied
mutants: accepting equality only and accepting exactly 9->9 only.

The receipt function matches the actual pure `sqlite_decision` output, including
violation order/PID lists and `authorization: false`. The Python oracle imports
the pinned files unchanged and calls pure functions only; observational entry
points and SQLite connect are replaced by throwing sentinels. Parity is exhaustive
on the **declared bounded domain**, not all natural counts, all process lists or
all OS states. See the machine-readable parity method and counts.

## Added run model (not a claim about shipped enforcement)

Production is a read-only preflight, not a stateful interposition. Accordingly the
lifecycle is explicitly a **hypothetical consumer of preflight facts**, not a
fictional port of a deployed replacement implementation:

* `snapshot` consumes a cached complete/empty scan and a known nondecreasing auth
  pair, then allows an external replacement. Opens/closes can interleave. Hidden
  holders model observations outside the scan's namespace/FD scope.
* `atomic` is a **proposed sufficient model**, not a change to z0: the action
  atomically rechecks all actual current/old-generation holders, main generation,
  auth epoch and known nondecreasing count. Every opener must participate in that
  same model. Arbitrary nonparticipating real writers are not ruled out.
* Counts aggregate any number of holders over DB/WAL/SHM; generation names model
  identity, not real numeric inode monotonicity. A replacement retains old
  references as ghosts, advances main generation and installs WAL/SHM for it.
  Sidecar removal requires an actor with a current main-file generation.
* Auth epoch advances on writes; scans retain the observed epoch and count.
  Reusing an old baseline does not mean preserving the immediately prior count.

The stronger needed properties are probed **without weakening them**. A
scan/open/replace run, an out-of-scope holder run and an old-auth-baseline run are
watched with `core/watch.ts`; both refutations and the sufficient atomic protocol
are kept. All successful step laws are also checked with `{from:'any'}` and no
reachable-state assumptions. The fixed 9->9 acceptance law is separately
generalized to arbitrary equal counts and known increases.

No chart is used in the source; the added count/epoch system is a rule, so
`chart.check()` is not applicable. No Lean export/check, proof of SQLite internals,
credential identity/set preservation, `/proc` accuracy, filesystem observation,
actual cross-process exclusion, deployment or repair is claimed. The private tape
is seven independent observations (historical reconstructions and hypotheticals),
not a complete ordered incident syscall trace.
