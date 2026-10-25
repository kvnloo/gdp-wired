# Intent gate: critic port, not a replacement runtime

Pinned source: z0intelligence **d75c94439b75df1786f4cbea966992450b781a7d**.
`vendor/` copies its public relay-guard sources/tests unchanged. The private
`replay.json` is never in this tree. gdp-wired base is `3cdf37e`.

- `port.ts`: exact Boolean/Nat gates; injective target IDs; extensional sets for
  `relay_allows`; mutant flags matching the source MUTATIONS array.
- `laws.ts`: all **46** `LAWS.bend` names in source order. Constant witnesses
  remain constant, with broader obligations separately listed in `extras`.
- `run.ts`: proofs, kernel checks, interpreter/compiled and builder checks,
  broken variants with concrete witnesses, and `from_any` verdicts.
- `critic.ts`: 26 source mutants and their law kills; invariant search on bare
  sequence laws; a derived lifecycle chart; an intentionally restrictive
  identity implementation that probes whether constant positive laws suffice.
- `extract.ts`: tries every top-level callable entry in all three unchanged JS
  files, with refusal locations. Retries document/verifier APIs with real
  canonical initial profiles rather than rewriting code to make it extract.
- `adapter.ts`, `parity.ts`: direct pinned JavaScript checker vs compiled-gate
  projection on 12,000 seeded, single-task synthetic documents, plus retained
  out-of-region challenges and a differential sabotage control.
- `replay.ts`: reconstructs the 20 private reviewed contracts, compares live
  checker, port and saved observations, then watches all recorded entries.
- `sequence-check.ts`: witnesses break the *target* ordering law, not merely
  an auxiliary invariant.

## Reproduce off-host

Use `fleet-build --node mbp --mem 2G --cpus 1 --wait 1800 --timeout 1800
--src THIS_WORKTREE --input PRIVATE_REPLAY:replay-input.json --fetch out
--out PRIVATE_RESULTS -- bash -lc '…'` and run inside the job:

```sh
bun install --frozen-lockfile
mkdir -p out
bun z0/intent-gate/run.ts --json out/battery.json --strict
bun z0/intent-gate/critic.ts --json out/critic.json
bun z0/intent-gate/extract.ts --json out/extract.json
bun z0/intent-gate/parity.ts --json out/parity.json
bun z0/intent-gate/replay.ts --input replay-input.json --json out/replay.json
node --test z0/intent-gate/vendor/*.test.mjs
```

`run.ts` without `--strict` records non-ok rows and exits zero by contract.
Never infer a passing battery from the shell status alone. Keep per-command exit
codes and JSON rows; keep private job inputs/results outside git.

## What the evidence means

A decision law universally quantifies its free inputs, so it has no
reachable-state restriction. Sequence extras use an unbounded `.log` and ghost
last-occurrence indices; helper invariants must themselves be proven. The
original timestamp laws allow equality at update/start, start/finish and
finish/record boundaries; strictly ordered separate log events are **not** a
claim that host timestamps are strictly increasing. No source law is replaced.

The event model is a single-task, single execution-window projection, **not**
an extracted JS implementation. Parsing, source authenticity, timestamps,
approval authority, causal/source/revision provenance, actual verifier effects,
preconditions, human review semantics and semantic classification are outside
the bare gates. Differential challenges intentionally retain such differences.
Nat proofs are unbounded mathematics; compiled runs use safe JavaScript integers.

Replay is counterfactual structural evidence. Missing historical acceptance
receipts are not proof no verification occurred. Generic historical tools stay
uninterpreted noise: exit zero is not invented as an acceptance receipt, and a
named worker is not invented as a live delegate. No prevention, authorization or
`verified_success` is awarded.

Authoritative execution results and classified findings are in the private
experiment results directory, not in this public-code worktree.
