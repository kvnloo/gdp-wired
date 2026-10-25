# Worker contract — gdp-wired × z0 laws

Every worker follows this file. The orchestrator re-runs your commands from your commit and rejects results that do not
match it.

## Paths

- Experiment root (results, private data never goes into git): `/mnt/zer0models/workspace/zer0/data/operations/gdp-wired-laws/`
- Your results dir: `<root>/<family>/` (family ids below). Create it.
- Your code: your own git worktree of the gdp-wired fork, `/mnt/zer0models/z0-wt/gdpw-<family>`, branch
  `exp/z0-<family>`, based on `exp/z0-base` (gdp-wired `3cdf37e` + `z0/`). `bun install` is already done there.
- Code lives only under `z0/<family>/` in your worktree (tools worker: `z0/tools/`). Do not edit `core/`, `kernel/`,
  `lean-kernel/`, `examples/` or another worker's directory. A gdp-wired bug or limitation is a finding
  (class `gdp_wired_limitation`), not something to patch.

Family ids: `work-item`, `worker-supervision`, `ops-stateful`, `ops-sqlite`, `intent-gate`, `control-root-cause`,
`control-ops-decisions`, `tools`.

## Code shape (copy examples/jev-fabric)

- `z0/<family>/port.ts` — the rules/functions/charts, each part citing the source it mirrors (`path:line` in the pinned
  z0 checkout: the Bend model AND the Python/JS twin). Broken variants are `bug` arguments, as in jev-fabric's policy.ts.
- `z0/<family>/laws.ts` — `export const bendLaws: Entry[]` (one per Bend `law`, in LAWS.bend order, same names) and
  `export const extras: Entry[]` (laws gdp-wired adds: generalized forms, laws over runs Bend does not state, laws the
  findings suggest). `Entry` is `z0/entry.ts` (jev-fabric's Entry plus `law_id` and `src`). Each Entry's `case()`
  returns `examples/harness.ts`'s `Case` (`decisionCase` / `machineCase`) with at least one broken variant.
- `z0/<family>/run.ts` — adapted from `examples/jev-fabric/run.ts`; `bun z0/<family>/run.ts --json OUT` writes the rows
  (also `from_any` per rule: the verdict of `proveSteps(..., {from: 'any'})` and whether `assumes` was set). It exits 0
  and records `ok` per row; `--strict` exits 1 on any non-ok row.
- Optional per family: `replay.ts` (real histories), `parity.ts` (twin differential), `extract.ts` (intent-gate).

## Results (in `<root>/<family>/`)

- `battery.json` — output of `run.ts --json`.
- `findings.jsonl` — one JSON object per line:
  `{"id": "<family>-F<n>", "family", "law": "<Bend law name or rule id>", "class", "severity", "summary",
    "evidence": {"command", "where": "mbp job id | local", "excerpt", "witness"},
    "triage_hypothesis": "bug|model|law|harness|encoding", "proposed_fix", "confidence": "high|medium|low"}`
  `class` is one of: `false_law_counterexample`, `non_inductive_needs_invariant`, `reachable_only_assumes`,
  `weak_law_generalizable`, `law_suite_gap`, `statechart_unreachable`, `statechart_stuck`, `statechart_ambiguous`,
  `twin_divergence`, `trace_divergence`, `encoding_gap`, `port_inexpressible`, `gdp_wired_limitation`,
  `missing_law_candidate`.
  `severity` is one of `real_weakness`, `minor`, `info`. You propose; an independent adjudicator decides later.
  `proposed_fix` is text only. Never edit z0intelligence.
- `parity.json` / `replay.json` when those steps apply: counts, method (sample count, what one sample is, seed),
  divergences each classified with the differential-transition-harness classes (production bug, adapter bug, kernel
  bug, stale or limited oracle, harness bug, intentional rule difference, known preserved debt).
- `REPORT.md` — status `PASS` | `ISSUES` | `BLOCKED`. Counts table. Every command you ran, where it ran (fleet job id or
  local) and its result. Port encoding decisions (exact / interned / abstracted, as jev-fabric). What is NOT proven.
  Timestamps of your start and finish.

Write `REPORT.md` early and update it, so a worker that runs out of turns still leaves evidence.

## Rules

1. The Bend laws are the owner's spec. Port each law as stated. Never weaken a law to make it pass. Where a faithful
   port is impossible, keep the law, say why (`port_inexpressible`) and state the nearest faithful form separately.
2. Read-only: every `/mnt/zer0models/z0-wt/*` checkout other than your own gdpw worktree, the z0 operations data, and
   other workers' dirs. No `git push`, no PRs, no issues, nothing upstream (monotykamary, rauchg, fabric-runtime).
   Commit locally on your own branch only, under `z0/<family>/`.
3. Private data (operations JSON/JSONL, tapes with owner messages) is read by absolute path or shipped to the MBP as a
   private job input (`fleet-build --input FILE:NAME`). It is never committed. Commit only code and synthetic fixtures.
4. Compute routing: read `/mnt/zer0models/workspace/zer0/data/operations/sol-runs/BRIEF-COMPUTE.md`. gdp-wired batteries,
   searches and anything over ~10 s run on the MBP:
   `fleet-build --node mbp --mem 3G --cpus 2 --wait 1800 --timeout 1800 --src /mnt/zer0models/z0-wt/gdpw-<family>
   [--input FILE:NAME] --fetch PATH --out DIR -- bash -lc 'bun install --frozen-lockfile >/dev/null; ...'`
   (bun is on the MBP job PATH as `/opt/fleet/bun/bun`; `/usr/bin/time` is absent, use `date +%s.%N`). Single quick
   commands under ~10 s may run locally. Never fall back to groot on exit 75; wait. Record every job id.
5. Per-command environment only (`env VAR=x cmd`). Never `export`; the shell is shared with other workers.
6. Do the work yourself. Do not launch `codex exec`, `claude`, `hermes` or other agents.
7. Findings are evidence, not authority. Nothing here authorizes an action or marks anything verified_success.
8. Before finishing: `git -C <your worktree> status` clean except ignored files, commit hash in `REPORT.md`, and your
   final answer matches the requested JSON schema.
