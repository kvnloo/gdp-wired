# Ops decision-table control (H0)

Pinned authority: `sqlite-store-laws@d2e346146380`, `bend/ops_fsm/LAWS.bend`.
This slice preserves exactly 38 source law names and their source-book order/ordinals.
Code and proof results are evidence, never authorization or verified success.

## Reproduce (MBP only)

Use `fleet-build --node mbp --mem 2G --cpus 1 --wait 1800 --timeout 1800 --src <this-worktree>`.
Supply `source-inputs.tgz` as private input (source Python/model/proof files and the five
incident tapes), then unpack it into `private-src`. No tape is in this Git tree.

```
bun install --frozen-lockfile
python3 z0/control-ops-decisions/reference.py --source private-src --out out
bun z0/control-ops-decisions/run.ts --json out/battery.json --strict
bun z0/control-ops-decisions/parity.ts out out
bun z0/control-ops-decisions/mutants.ts out/source-mutants.json out/mutants.json
python3 z0/control-ops-decisions/cost.py --source private-src --results out
bun node_modules/typescript/bin/tsc --noEmit -p z0/control-ops-decisions/tsconfig.json
```

For the common structural critic, stage the tools worker's `mutate.ts` as this family's
`mutate-tool.ts` and `decisions.ts` beside it, using `fleet-build --input`. Do not overwrite
or change the tools worker checkout. `auto.ts` records hashes of both supplied files:

```
bun z0/control-ops-decisions/auto.ts z0/control-ops-decisions out/automatic-mutants.json
```

## Encoding and limitations

* Booleans, enums and natural arithmetic are exact. Natural runtime values are restricted
  to JavaScript's safe integer range; proof naturals are unbounded.
* O6 list membership factors through sets; order and duplicates are irrelevant to the
  reference rule. `first` retains the head solely for the first-only source mutant. Its
  encoding constraint requires membership when Pre is nonempty; every source list has
  such an encoding. Concrete parity includes all ordered lists up to length 3 over 3 names.
* `reference_place` is an instrumentation observation of Bend's `place_phone(ready)`;
  it is not a new deployed output. Source mutations 3 and 4 change that helper on both
  sides of the O10 equality. Mutating only one side would misrepresent the source mutant.
* O11/O12 has **no scalar ops.py policy twin**. The generator labels its separate Bend
  transcription a limited oracle; receipt-audit/expiry/deployment logic remains unproven.
* Tape replay calls the pinned Python classifiers, not guessed replacements. O4 visibility
  is the frozen named-repository fact from the tape, not a live GH query. O7's config is
  serialized to JSON and loaded with a narrowly declared JSON-only YAML shim. No real
  phone, service, git push, cached account state or live guard configuration is touched.
* Unclassified O1 commands remain abstentions requiring an explicit class. They are not
  assigned the expected answer or counted as mapped interpreter steps.
* Single-case and two-run sampling is premise-guided without changing proof machines or
  law callbacks. Proofs remain universal. From-any decisions are the identical request
  implication on a stateless step, not a claim about a persistent implementation.
* No statecharts exist in this slice. Every original law proves without synthesized
  invariants; chart checks and invariant repair are therefore not applicable.
* Per-law timings are medians of five in-process proofs. The pinned Bend receipt carries
  no per-law elapsed time; this experiment must not claim a measured speedup from it.
