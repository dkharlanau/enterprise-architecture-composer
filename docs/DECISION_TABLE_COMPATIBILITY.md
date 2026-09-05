# Decision Tables as Code compatibility

Enterprise Architecture Composer currently owns integration-pattern reasoning in `src/integration-decision.mjs`. Issue #27 evaluates whether mature parts of that reasoning are easier to review when expressed through [Decision Tables as Code](https://github.com/dkharlanau/decision-tables-as-code).

The prototype deliberately does **not** move runtime ownership yet.

## Prototype scope

The artifact [`compatibility/decision-tables/integration-pattern-v1.json`](../compatibility/decision-tables/integration-pattern-v1.json) follows the Decision Tables as Code v1 decision-table contract and expresses decisive semantic cases for:

- analytical publication → ETL/ELT;
- partner documents → EDI/B2B;
- internal replication → CDC;
- business facts with multiple consumers → domain event;
- immediate one-consumer business requests → synchronous API;
- delayed or very-large state transfer → batch/file;
- normal state transfer and commands → asynchronous messaging.

It is intentionally narrower than the complete Composer integration kernel. Detailed pattern fit, incompatibilities, conflicts, alternative analysis, and explanatory trade-offs still belong to `src/integration-decision.mjs`.

## Ownership boundary

The prototype has three explicit roles:

| Concern | Owner |
| --- | --- |
| Architecture orchestration, NFR collection, conflicts, alternative analysis | Enterprise Architecture Composer |
| Decision-table contract and future table execution semantics | Decision Tables as Code |
| Compatibility fixtures between the two | Enterprise Architecture Composer `compatibility/decision-tables/` |

Composer contains **no decision-table evaluator**. It does not implement wildcard matching, operators such as `gte`, hit-policy processing, or table rule execution. Adding such an evaluator here would duplicate the downstream product's semantic ownership.

## Deterministic behavior comparison

[`integration-pattern-v1.vectors.json`](../compatibility/decision-tables/integration-pattern-v1.vectors.json) defines representative inputs and points each input at the table rule that represents the same decisive case.

The compatibility report:

1. reads the output of that named table rule directly from the artifact;
2. runs the same architecture input through native `decideIntegrationPattern()`;
3. compares stable `pattern.*` IDs;
4. reports any divergence as a mismatch.

It does **not** execute the table's `when` expression. The downstream Decision Tables as Code runtime remains responsible for proving table execution semantics independently.

Run the comparison:

```bash
node bin/eac-decision-table-compat.mjs --summary
```

A non-zero mismatch result exits with code `3`.

## Readability comparison

For this bounded family, the table is easier to review in several ways:

- inputs and outputs are declared before rules;
- rule order is visible through `hit_policy: first` and priorities;
- each rule has a stable, human-readable ID;
- each rule points back to a Composer rule ID such as `INT-B2B-001`;
- a reviewer can scan the decisive cases without reading pattern-evaluation functions.

The native implementation remains better for logic that needs rich diagnostic output. A native evaluator can say not only that a pattern lost, but why it is `acceptable`, `disfavored`, or `incompatible`, and can expose multiple trade-offs and unresolved conflicts. Encoding all of that in a flat table today would reduce rather than improve readability.

## Current conclusion

Decision tables are a good candidate for **mature, categorical decision families** whose input vocabulary and outputs are stable. They are not automatically a better representation for every architecture rule.

The recommended evolution path is:

1. keep this compatibility prototype as a reviewable artifact;
2. let Decision Tables as Code own actual table evaluation;
3. expand only when a rule family becomes stable enough that table readability is clearly better than native code;
4. if runtime ownership moves, replace the native semantic branch rather than maintaining two independently executable copies.

Until that migration is deliberate, Composer remains the runtime source of truth and the table remains a compatibility prototype with deterministic golden equivalence fixtures.
