# Shared law measurement tools

Run proving, mutation and calibration on the MBP, not groot:

```sh
fleet-build --node mbp --mem 2G --cpus 1 --wait 1800 --timeout 1800 \
  --src /mnt/zer0models/z0-wt/gdpw-tools --fetch out --out RESULTS \
  -- bash -lc 'bun install --frozen-lockfile >/dev/null; bun z0/tools/battery.ts --laws z0/tools/jev-laws.ts --json out/battery-jev-fabric.json --seed 1729 --strict'
```

## Battery

```sh
bun z0/tools/battery.ts --laws z0/FAMILY/laws.ts --json out/battery.json \
  [--mutants 200] [--seed 1] [--trials 200] [--depth 12] [--bound 4] [--strict]
```

Imports `bendLaws` and `extras` (Entry from `z0/entry.ts`). Run tools and laws from the **same checkout** (integrate/cherry-pick `z0/tools/` first); loading a sibling worktree's laws creates a second DSL module instance whose public Fun callbacks are not captured by this process. Optional `family` export names the dataset. Five proof timings (median), all accepted checked proofs, interpreter/generated-JS runs, builder callback cross-checks, and each handwritten broken variant refused **and** broken by a concrete run/draw are recorded per Entry. The Entry witness fallback is accepted only for a single broken variant. `from_any` re-proves rule cases with `{from:'any'}` and retains `assumes`. This is the existing example harness's TypeScript/kernel checks, **not an executed Lean check**. Harness draws use its fixed case-name seed; `--seed` controls mutation probes.

Identical compiled implementations are grouped; all their Entry laws (Bend plus extras) are combined before mutation. Rows link to `mutation_case`; each `mutations[]` group names its `law_ids`. Therefore a rule referenced by 10 laws contributes one set of mutants, not 10 duplicate denominators. Groups are per compiled implementation, not functions that merely look semantically similar. A name collision with differing law terms is an explicit error. `--mutants 0` disables mutation. The JSON is checkpointed after each Entry/group; `complete:false` means an interrupted partial measurement. Default exits 0 with `ok` per Entry; `--strict` exits 1 if an Entry is not ok. Unknown mutants do not fail the original-rule triple check.

Calibration adapters: `jev-laws.ts` covers every jev-fabric Entry; `domain-laws.ts` covers tenant quotas, autoscaling, and a per-node lease from `examples/domains/cloud.ts`, retaining every law and broken variant.

## Mutation instrument

```ts
import {enableDecisionCapture} from './decisions.ts'
import {mutateCase} from './mutate.ts'
enableDecisionCapture() // before importing/constructing Fun-based cases
const result = mutateCase(entry.case(), {cap: 200, seed: 1729, trials: 200})
```

`machineEdits` enumerates deterministic single-site edits to transition flags, request assumptions, scalar/map updates and history keep guards: `< ↔ <=`, `= → <=`, `add ↔ sub` (natural truncated subtraction), `min ↔ max`, `and ↔ or`, conjunct removal, not insertion/removal, branch swap, natural constants ±1, and identity state updates. Initial values, parameter preconditions, external function facts and **the laws themselves** are fixed. Cap 200 applies in stable traversal order; `candidates` and `truncated` expose omissions. IDs are group-local; globally identify a mutant by dataset/group/id.

For a rule, the raw compiled implementation is re-proven by the kernel against fixed laws (one-second cooperative proof deadline per suite/law). Seeded runs monitor every invariant, step and k-step law on reachable states. They also compare the mutant interpreter with its generated JS. A kill requires a concrete law-breaking run/draw; a solver's arbitrary-state witness alone is not a kill. The matrix is `matrix[lawName][mutantId]`, with checked verdict and concrete witness for kills. Requests carrying maps are serialized as `{__map__: [[key,value],...]}` in artifacts; this avoids empty-object evidence.

For a `Fun` decision, the instrument captures the **public** `returns`, `law` and `relate` callbacks, then reruns the unchanged law callbacks over a single changed return expression. It never substitutes matching syntax into an inlined law: that could change the expected constant/input as well as the output and manufacture false survivors. Capturing wrappers are installed once per process, before module import; they only retain callbacks. Numeric scalar results and condition results are supported. Bare `rule.decide` has no retained implementation/spec boundary and is explicitly unsupported. Structured enum/maybe/record results, uncaptured prebuilt functions, edits leaving the boolean output encoding, decision assumption edits and groups containing differing functions are unknown/unsupported, never credited as kills. Loops are out of scope. Unsupported cases and errors remain in output.

Classifications:

- `killed`: a stated law is concretely violated. A checked proof plus concrete violation is an instrument/kernel error, classified unknown instead of inflating the score.
- `survived`: the whole mutant law suite is proven **and** kernel checked, and no run violates it.
- `unknown`: timeout, unsupported form, runtime/compiler error, or an unproved suite without concrete refutation.
- `likely_equivalent`: a surviving mutant agrees on acceptance/refusal, every flag and entire observable state (scalars, maps/defaults/history) for N seeded trials with at least one executed step. It is a bounded observational heuristic, **not a proof of equivalence**. Failed preconditions can reduce completed trials; those do not receive this label.

Score = `killed / (total - likely_equivalent)`; empty denominator is null. Unknowns remain in the denominator. Report K/S/U/LE as well as the score, scope and cap. This mutation score is specific to the stated laws, encoding and operator set, not production correctness or seeded-defect recall.

## Aggregation

```sh
bun z0/tools/aggregate.ts --root /mnt/zer0models/workspace/zer0/data/operations/gdp-wired-laws
```

Reads immediate `*/battery*.json` and `*/findings.jsonl`; writes `MATRIX.md` and `matrix.json`. Supports legacy array batteries and shared `{rows,...}` batteries. Missing families are unknown, malformed files/duplicate finding IDs are reported, findings are counted by class and severity without adjudicating them. Native `battery.json` is canonical; auxiliary remeasurements remain separate datasets, never silently added to the same total. With multiple noncanonical datasets (e.g. tools calibration) no ambiguous combined score is invented. Timings not recorded in inputs remain null.

## Hand-checked survivors

```sh
bun z0/tools/survivors.ts --battery battery-domains.json --json survivors.json
```

Run via fleet-build with the battery as a private `--input FILE:domains-input.json`. This reproduces five source-inspected survivors: three concrete observable law-suite gaps (quota operation guard, autoscaler identity, lease operation guard) and two exact natural-number predicate equivalences. It requires the referenced rows to have survived, checks legal explicit traces against every stated law, and kernel-checks the universal `x=0 iff x<=0` lemma for the two equivalent sites. It does not upgrade other likely-equivalent rows to proven equivalence.

## Verification

```sh
bun test z0/tools
bun node_modules/typescript/bin/tsc --noEmit -p z0/tools
```

Use those commands through fleet-build. MBP has `bun` but not necessarily a `bunx` executable. Regression tests exercise actual builders/kernel/runtimes, unchanged decision literals, boolean return handling, witnessed kills, observable law gaps, deterministic caps, unsupported decisions and aggregate input failures.
