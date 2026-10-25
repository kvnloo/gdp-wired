# worker-supervision critic port

Pinned reference: `sqlite-store-laws@d2e34614638059b38da77fd5f0bb582af500a503`.

- `port.ts`: worker chart, lease and device transition rules, original 17 Bend mutants.
- `laws.ts`: 19 entries in original `LAWS.bend` order; three independent extras.
- `run.ts`: proof/check, interpreter/compiled/builder comparison, broken runs, from:any,
  full original-mutant × law matrix, additional suite-gap mutants, chart check,
  isolated-placement invariant search, fairness probes.
- `witness.ts`: explicit synthetic counterexample tapes, interpreted and watched.
- `oracle.py`: loads the original Python twin as an external private job input; makes
  10,000 worker sequences plus arbitrary-observed-state and resource sequences.
- `parity.ts`: stepwise Python/interpreter/compiled comparison, sabotage check,
  real-tape watch replay, owner-decision/outcome joins and frozen queue inspection.

Run computation on the MBP, not groot:

```
bun install --frozen-lockfile
mkdir -p out
bun z0/worker-supervision/run.ts --json out/battery.json --strict
# private-inputs.tar.gz is supplied via fleet-build --input, NEVER via git:
tar -xzf private-inputs.tar.gz
python z0/worker-supervision/oracle.py
bun z0/worker-supervision/parity.ts
```

`run.ts` exits zero even on recorded failed rows unless `--strict` is supplied.
Results are evidence, never authority or verified_success.

## Encoding and boundaries

Worker context flattens the Bend tagged union: only fields of the active phase
are semantically observed. Heavy/load, exception, host, clocks, background count,
and successor are exact naturals/enumerations. Unused immutable `W.id` and `W.wt`
are erased; worker entries therefore say `abstracted`, not whole-record equivalence.
Lease ownership and device observation/effect fields are exact. Device effects
are captured as per-step output bits and reconstructed with the request actor/app.

`end_needs_reaped` uses `Dispatched => bg_of = 0`, the exact structural source
fact, not an assumed zero for arbitrary extraneous flattened context. Placement
laws are mutually inductive (Beat can turn Stalled back into Running). Both
unchanged original claims are passed together; from:any is relative to these
explicit laws, NOT a proof that every observed host is already correctly placed.

Original M07 changes only Interrupted-resume adoption and M10 only Interrupted
abandonment. Separate Overdue adoption sabotage is not silently merged into M07.

Persisted supervision event JSON omits Start.h and Resume.by. Fixed GROOT host
is recovered from `supervise.py:964`; successor is an explicit abstraction and
cannot be recovered independently from that tape. Owner `resume` is a routing
disposition, not log-read evidence. Replay uses `log=false` for that request and
never fabricates Finish to integrate an interrupted worker. External projection
in `supervise.py:1009-1012` and outcome claims are reported separately.

Limits: no new Bend or Lean recheck, no proof of event-extraction fidelity,
no OS/process/phone actions, no genuine execution-success claims. Runtimes
use safe JavaScript naturals; proof arithmetic is unbounded naturals.
