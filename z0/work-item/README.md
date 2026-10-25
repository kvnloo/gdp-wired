# work-item law critic (shadow-only)

Pinned z0intelligence input: `sqlite-store-laws` at `d2e34614638059b38da77fd5f0bb582af500a503`.
No owner spec, production branch, core, kernel or example is modified.

## Commands (run on MBP, not groot)

```sh
bun z0/work-item/run.ts --json out/battery.json
bun z0/work-item/run.ts --strict --json out/battery.json
python3 z0/work-item/oracle.py --twin work_item.py --history history.json --out out/oracle.jsonl
bun z0/work-item/parity.ts --oracle out/oracle.jsonl --out out
bun z0/work-item/probes.ts out/probes.json
```

The two Python/JSON inputs are shipped privately using `fleet-build --input FILE:NAME`.
`verify_results.py RESULTS --source-laws /absolute/pinned/LAWS.bend` is a tiny local read-only artifact/count validator; it runs no proving or replay. Run it from a clean committed worktree after fetching the results and promoting the additional generalization `probes.json`.
Use `--node mbp --mem 2G --cpus 1 --wait 1800 --timeout 1800 --src <this-worktree>`;
install on MBP with `bun install --frozen-lockfile`. Do not commit generated/private outputs.

## Port and checking scope

* `port.ts`: transition table, chart, availability wrapper, pointwise board projection, constructor decoding, 10 Bend mutants plus per-law negative controls. Actors and heads are injectively interned names. Number equality mirrors Bend actor-ID equality (roles do not participate in actor identity).
* `laws.ts`: 15 Bend laws in exact source order; reachable-state acceptance/coder helpers are independently proven beside the original unchanged claim. Universal one-step claims start from arbitrary matching constructors. `owner_off_holds` and board equalities prove equality of **all** flat fields, which is stronger than constructor equality. No law is weakened to hide a failure.
* `run.ts`: kernel proof and from:any verdict per entry, original-claim-only from:any comparison, interpreter-vs-compiled runs and builder callback cross-checks, refused negative proofs and concrete target-law counterexamples; full 10×15 source mutation matrix, chart.check, bounded inferLaws attempts. Negative witnesses ignore helper failures and must break the target law itself.
* Four proven extras: arbitrary-coder resume, arbitrary-steward abandon, never entering Merged twice, and acceptance preceding merge at arbitrary distance (unbounded ghost counters plus proven helpers, not a bounded temporal approximation).
* `oracle.py` loads the actual pinned Python module independently, not a rewritten Python model. Registered domain: 10,000 seeded event tapes with complete actor/head representations, length at most 48, seed 20261025, mixed arbitrary and directed prefixes. Every transition is compared, including refusals, not only final states.
* `parity.ts`: interpreter, compiled rule, compiled chart and Python constructor projections; all 175 frozen real tapes; core/watch monitors for all 15 claims. The last three use availability/board projections because the history does not record availability or cross-item targeting. Their observed verdict is indeterminate, not a factual claim about Kevin being available. Separately compares evidence diagnostics with stored Python findings, classifying broader observational scope instead of turning legal-state theorem watches into evidence detectors.
* Extra boundary probes preserve the None-head divergence and test post-acceptance drift. Early-merge sabotage uses a separate Python-minted tape and requires the unmodified model to agree with that independent oracle.
* `probes.ts` also checks an additional `no-opus-resume` mutant against all 15 original claims: disabling only Opus resume is not covered by the Sol-only Bend progress law; the arbitrary-coder extra must reject it with a concrete witness. This is distinct from the ten supplied Bend mutants.
* `probes.ts` keeps a **proposed**, not owner-authorized, drift-after-acceptance claim. Failure is expected: the original model ignores Observe after acceptance. No policy has been changed.

## Not proven

The board projection/list refinement is a mathematical encoding argument, not a kernel-checked theorem over the original Bend lists. Constructor-irrelevant fields are projected away exactly as documented by Python Item. The representation `None -> 0` for an absent initial head is not injective relative to a natural zero: a dedicated boundary probe records the mismatch instead of normalizing it away. Missing metadata, real actor attribution, service ancestry, elapsed-time obligations, receipt provenance, arbitrary SHA parsing, source/compiler equivalence, and operational success are not established by these proofs. Neither Lean export nor Bend receipts are rerun here; the pinned Bend receipt and mutation file are comparison evidence only.

A successful proof is evidence, never authorization or verified_success. Proposed finding severities require independent adjudication.
