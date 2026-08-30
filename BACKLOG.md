# Product Backlog

GitHub Issues are the execution source of truth. This document explains ordering and dependency logic.

## Milestone A — Executable vertical slice (P0)

The goal is not broad catalog coverage. The goal is one end-to-end workflow that already feels like a product.

| Issue | Deliverable | Depends on |
| --- | --- | --- |
| #1 | enterprise composition domain model | — |
| #3 | manufacturing reference catalog v0.1 | #1 |
| #2 | deterministic architecture synthesis engine | #1, #3 |
| #5 | integration pattern decision model | #2 |
| #6 | implementation work packages / dependency roadmap | #2 |
| #4 | interactive Architecture Composer workbench | #2, #3 |
| #14 | deterministic tests, fixtures and CI | #2, #3 |
| #15 | GitHub Pages + portfolio publication | #4, #14 |

### Exit criteria

A user can open a public page, configure a manufacturing scenario, compose a target blueprint, inspect why elements were selected, see integration recommendations/gaps, and inspect a generated implementation roadmap. The same scenario is covered by deterministic Node tests.

## Milestone B — Architecture tool, not demo (P1)

| Issue | Capability |
| --- | --- |
| #7 | scenario comparison / architecture delta |
| #8 | Process-as-Code proposal export |
| #9 | Interface-as-Code proposal export |
| #10 | Visual Workbench projection |
| #11 | architecture gap diagnostics |
| #13 | portable blueprint / shareable scenario files |
| #16 | import an existing landscape as constraints |
| #22 | current / transition / target state semantics |
| #23 | structured non-functional requirements |
| #24 | architecture glossary / semantic IDs |

### Exit criteria

Composer can represent the difference between existing and target architecture, import known facts, compare scenarios and hand accepted proposals into the wider as-code ecosystem.

## Milestone C — Extensible knowledge product (P2)

| Issue | Capability |
| --- | --- |
| #12 | industry/vendor packs |
| #17 | human architecture decisions and overrides |
| #18 | rule/catalog evidence provenance |
| #19 | deterministic review report |
| #21 | structural architecture metrics |
| #25 | solution option comparison |
| #26 | bounded AI-assisted intake |
| #27 | Decision-Tables-as-Code compatibility research |
| #29 | public pack contribution format |
| #30 | work-package handoff to GitHub Issues |
| #32 | trust boundaries / security composition |

### Exit criteria

The reference knowledge can grow through independently versioned packs without turning the core into a vendor catalog or opaque AI recommender.

## Milestone D — Research / scale (P3)

| Issue | Research direction |
| --- | --- |
| #20 | constraint/graph search across multiple valid blueprints |
| #28 | evidence feedback from delivery/runtime outcomes |
| #31 | federated organization-scale composition |

These tasks deliberately stay behind the deterministic reference product. Optimization or feedback learning must not arrive before rule explanations, versioning and provenance are reliable.

## UX backlog embedded in #4

The workbench should evolve in this order:

1. preconfigured reference scenario that communicates the product instantly;
2. context controls for processes + key constraints;
3. blueprint layer view;
4. click/select architecture object to explain why it exists;
5. integration view with pattern reasoning;
6. roadmap view;
7. gaps/questions rail;
8. scenario comparison.

Do not start with free-form drag/drop. Manual diagram construction would move the product back toward a crowded modeling-tool category and weaken the composition thesis.

## Reference knowledge growth order

After the first manufacturing slice is correct:

1. deepen manufacturing rather than add another industry immediately;
2. add multi-company and partner/B2B patterns;
3. add SAP vendor mapping pack because it can be grounded in realistic examples;
4. add automotive extension to manufacturing;
5. only then add retail / services and other vendor packs.

## Rule maturity model

Every rule progresses through explicit maturity:

`experimental → fixture-backed → documented → stable`

A stable rule should have:

- a stable ID;
- clear inputs;
- deterministic output;
- at least one positive fixture;
- at least one boundary/negative fixture;
- human-readable rationale;
- provenance/evidence where the rule is based on a standard or external vendor fact.

## Non-goals for the first releases

- thousands of software products;
- automated procurement/vendor selection;
- a universal EA score;
- importing an entire CMDB before one scenario can work;
- LLM-generated architecture with no rule trace;
- canvas-first manual diagramming;
- realtime multi-user collaboration;
- replacing LeanIX, Ardoq, Signavio or Backstage.

## Agent-loop execution rule

When working autonomously, prefer the smallest open issue that improves a usable vertical slice. Each loop should:

1. inspect current repository and open P0/P1 blockers;
2. implement one coherent increment;
3. add/update deterministic tests where semantics changed;
4. update docs only when behavior or contracts changed;
5. close the GitHub issue only when its acceptance criteria are materially satisfied;
6. continue to the next dependency instead of adding speculative breadth.