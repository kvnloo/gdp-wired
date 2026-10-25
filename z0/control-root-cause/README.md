# Finite-control law critic

This is experimental evidence tooling, not a guard, cleanup actor or authority.
Source pin: z0intelligence `f46ecbffda3f0b5df5a2d7fd5b0c6c6b8e8256f5`.

## Files

- `port.ts`: the exact finite decision functions, plus explicitly separate observation-stream extensions.
- `laws.ts`: the 52 Bend obligations in original file/name order, and additional generalized, two-call and run-level laws. Every entry has a deliberately broken implementation.
- `run.ts`: five-repeat per-law timing, the unmodified example harness's kernel/run/builder/broken checks, from-any observation proofs, all Bend-source mutants and placement-chart audit. `--strict` makes unsuccessful rows fail the command.
- `oracle.py`: executes four supplied Python modules; produces the complete declared finite products, original root parity invalid-input probes, R7 threshold cases and seeded lease-boundary cases. It observes actual R2 calls for each prefix of the source incident fixture.
- `parity.ts`: compares model outputs with those actual Python outputs, and proves that deliberate test-owned sabotage is detected.
- `prove.ts`, `cost.py`: proof-only whole-process cost measurements for both tools. Native Bend is measured three times; `--verdict` once. Failures are preserved, not converted into timings of successful proofs.

## Run off-host

Use `fleet-build --node mbp --mem 2G --cpus 1 --wait 1800 --timeout 1800`.
Never run a battery or parity here on groot. Never run a local language server.
Stage the pin's four Python modules, the three Bend families, source incident
fixture and private histories as an uncommitted job input archive. `twins/` is
an input directory created only in the remote job, never committed here.

```sh
bun install --frozen-lockfile
mkdir -p out
tar -xzf inputs.tar.gz
bun z0/control-root-cause/run.ts --json out/battery.json --strict
python3 z0/control-root-cause/oracle.py --twins twins --out out/oracle.json
bun z0/control-root-cause/parity.ts --oracle out/oracle.json --json out/parity.json --replay out/replay.json
python3 z0/control-root-cause/cost.py --source twins --battery out/battery.json --out out/cost.json
bunx tsc --noEmit -p z0/control-root-cause/tsconfig.json
```

Fetch the five JSON artifacts to the private operations results directory.
Use `fleet-build --bend-tools` for the cost stage. Cost includes cold command
medians separately from warm per-law proof medians; no GPU-runtime speed or
billable-token comparison is inferred.

## Encoding and limits

Root evidence is exactly `absent | false | true`; verdicts are 0 unknown,
1 pass and 2 violation. The full R3 result also has 3 rollback recommendation.
Python R3 is compared with `r3_result`, not with the intermediate eligibility
gate. A passing probe is negated into `probe_failed` by the explicit adapter.

Lease and placement Bend bits are Boolean. Separate tri-state input adapters
match Python's strict non-bool/absent handling; sources, timestamps, paths,
liveness observation and archive identity are outside these finite proofs.
R7's Python twin only has a Boolean input contract; its missing-evidence Bend
cases have no corresponding Python oracle and are never claimed as parity.

Observation streams re-evaluate a snapshot at each step. Run-level laws reject
sticky earlier passes after missing evidence or lost archive readiness. They do
not model deleting anything or authenticate an actor's archive-before-delete
sequence. The placement chart is a report recomputation chart, not a lifecycle.

Private reaper reports lack complete source-bound Law G inputs. The replay
receipt inventories them and states the gap; it never fabricates missing bits
from historical eligibility or interprets missing evidence as a successful
replay. The source incident fixture is synthetic and labelled as such.
