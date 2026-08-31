# Evidence and provenance

Enterprise Architecture Composer distinguishes **architecture logic** from **evidence about that logic**.

A rule can be deterministic and useful without being an industry standard. The provenance registry makes that distinction explicit so users can inspect where a recommendation came from and when its supporting method should be reviewed.

## Evidence types

The current registry uses two evidence types:

- `internal-methodology` — a method defined and maintained in this repository;
- `heuristic` — reference architecture knowledge or decision logic intended to guide design, not to claim universal correctness.

The v0.2 registry intentionally does **not** label any source as `standard` or `vendor-docs`. Those labels should only be introduced when the source is actually backed by the relevant external standard or authoritative vendor documentation.

## What can be traced

The provenance API can resolve:

- one rule ID;
- one reference catalog object;
- one composed recommendation;
- all recognized rules and catalog objects used by one composition.

Example:

```bash
node bin/eac-provenance.mjs rule INT-SYNC-001
node bin/eac-provenance.mjs object sys.erp
node bin/eac-provenance.mjs recommendation \
  examples/scenarios/o2c-starter.context.json \
  rec.integration.sales-order-request
```

A recommendation provenance record combines the rule sources with any recognized catalog objects referenced by the decision.

## Staleness is explicit

The deterministic composer never reads the wall clock. Provenance staleness is evaluated only when a caller supplies an explicit `as-of` date:

```bash
node bin/eac-provenance.mjs result \
  examples/scenarios/o2c-starter.context.json \
  --as-of 2026-08-31

node bin/eac-provenance.mjs stale --as-of 2027-03-01
```

`reviewAfter` dates do not silently change a blueprint or recommendation. They only create an auditable review signal in the provenance output.

## Source fields

Each provenance source contains:

- stable source ID;
- evidence type;
- title;
- logical source URI;
- effective date;
- last review date;
- review-after date;
- a boundary note explaining what the source does and does not claim.

## Design rule

Evidence may challenge a rule, but it does not silently mutate the rule. A rule change must be an explicit versioned repository change with updated tests and provenance metadata.
