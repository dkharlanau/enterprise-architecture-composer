# Architecture

## Architectural goal

Build a small deterministic core that can answer:

> Given a validated enterprise context and a versioned knowledge pack, what blueprint elements, decisions, gaps and work packages are implied?

The browser workbench is a client of this core. It is not the source of truth.

## Bounded model

```text
                  ┌──────────────────────┐
                  │  Enterprise Context  │
                  │ scope + constraints  │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Reference Catalog(s) │
                  │ stable semantic IDs  │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │   Composition Core   │
                  │ select / derive / QA │
                  └─────┬─────┬─────┬────┘
                        │     │     │
            ┌───────────┘     │     └────────────┐
            ▼                 ▼                  ▼
      Blueprint graph   Decision traces   Work packages
            │                 │                  │
            └─────────────────┼──────────────────┘
                              ▼
                        Projection layer
                ┌─────────────┼──────────────┐
                ▼             ▼              ▼
             Browser      JSON/Markdown   Ecosystem exports
             workbench                    / Visual Workbench
```

## Semantic ownership

Composer may reference or generate starter artifacts for other repositories, but it must not create competing mutable truth.

| Semantic | Owner after adoption | Composer role |
| --- | --- | --- |
| enterprise composition context | Composer | authoritative |
| architecture recommendation/rationale | Composer | authoritative |
| scenario and scenario delta | Composer | authoritative |
| maintained business process | Process as Code | proposal/export |
| maintained interface operational contract | Interface as Code | proposal/export |
| maintained mapping | Mapping as Code | reference/proposal |
| release/change impact | Enterprise Change Graph | seed/reference |
| rendered visual grammar | Visual Workbench | projection |

## Core entities

### EnterpriseContext

Facts supplied or explicitly approved by the user.

```js
{
  industry: 'manufacturing',
  operatingModel: 'b2b',
  processes: ['order-to-cash'],
  scale: { countries: 8, plants: 4, warehouses: 11 },
  constraints: {
    multiCompany: true,
    highVolume: true,
    retainLegacyWms: true
  },
  existingSystems: ['erp', 'legacy-wms']
}
```

The engine must not infer sensitive or company-specific facts from a public reference catalog.

### CatalogObject

Reusable semantic object with a stable ID.

Common fields:

- `id`
- `kind`
- `name`
- `description`
- `aliases[]`
- `tags[]`
- `provenance`

Initial kinds:

- `capability`
- `process`
- `system-role`
- `data-object`
- `integration-pattern`

### BlueprintObject

A catalog object selected or materialized in the specific scenario.

Additional fields:

- `reasonIds[]`
- `state`: current / target / transition (future)
- `intent`: keep / introduce / replace / retire (future)

### Recommendation

```js
{
  id: 'rec.integration.order-created',
  kind: 'integration-pattern',
  decision: 'domain-event',
  confidence: 'high',
  because: [
    'downstream consumers do not need to block order acceptance',
    'high-volume processing benefits from decoupling'
  ],
  ruleIds: ['INT-EVENT-001'],
  alternatives: ['async-message']
}
```

`confidence` means confidence of the deterministic rule under known facts (`high`, `medium`, `conditional`), not a statistical probability.

### Finding

A deterministic quality/gap result.

```js
{
  id: 'finding.data-owner.customer',
  severity: 'warning',
  kind: 'missing-data-owner',
  objectIds: ['data.customer'],
  message: 'Customer has no explicit system of record.',
  nextDecision: 'Select the authoritative customer master system.'
}
```

### WorkPackage

```js
{
  id: 'wp.integration.order-events',
  phase: 'integration',
  title: 'Implement order event publication',
  mandatory: true,
  sourceIds: ['process.order-to-cash', 'integration.order-created'],
  dependsOn: ['wp.foundation.integration-platform']
}
```

Work packages are proposals. They are intentionally suitable for later GitHub/Jira export, but external issue state is not owned by Composer.

## Composition phases

The deterministic engine executes a fixed sequence:

1. normalize and validate context;
2. select process definitions;
3. derive required capabilities;
4. derive logical system roles;
5. derive data objects;
6. derive integration needs;
7. choose/recommend integration patterns from constraints;
8. run architecture quality/gap diagnostics;
9. generate work packages;
10. normalize/sort output for deterministic serialization.

Rules may add facts only through explicit stable IDs. Hidden mutation and order-dependent side effects are prohibited.

## Rule classes

### Scope rules

Example: selecting `order-to-cash` requires Order Management, Fulfilment, Billing and Customer Management capabilities.

### Responsibility rules

Example: production execution scope requires a Production Execution system role; the rule does not prescribe a vendor product.

### Integration-need rules

Example: a process step crossing CRM → ERP on Sales Order requires an integration need even before a transport pattern is chosen.

### Pattern rules

Example:

```text
requires immediate answer + one principal consumer
  => synchronous API preferred

no immediate answer + high volume + multiple downstream consumers
  => domain event preferred

external trading partner + standard business document exchange
  => EDI/B2B preferred
```

If decisive facts conflict or are missing, emit a `question` rather than force a recommendation.

### Quality rules

Examples:

- process crosses systems but no integration exists;
- critical data object has no system-of-record decision;
- async high-volume flow lacks replay/reconciliation decision;
- multi-company process has no explicit intercompany/control scope.

### Delivery rules

Translate blueprint objects into implementation work packages and dependency edges.

## Reference packs

Core references should be versioned and composable:

```text
catalog/
  core/
  industry-manufacturing/
  vendor-sap/             # later
  vendor-microsoft/       # later
```

The first executable version keeps the small manufacturing reference data in one JS module for speed. Once the model stabilizes, pack data should move to schema-validated data files.

Vendor packs map logical roles/capabilities to solution options. They do not redefine the core meaning of `erp`, `customer-management`, or `domain-event`.

## Interoperability boundaries

### Process as Code

Composer exports a starter process proposal with composer provenance. Once adopted, future process changes are maintained in Process as Code and may be imported back as current-state evidence.

### Interface as Code

Composer can export source, target, business object, mode, pattern and known NFRs. Unknown operational details such as retry ownership must remain explicitly unknown until designed.

### Visual Workbench

Composer emits a visual projection: semantic nodes/edges/groups/views referencing blueprint IDs. Visual Workbench owns layout and presentation. Composer does not store canvas coordinates.

### Enterprise Change Graph

Scenario delta can later seed change-impact analysis, but Composer remains focused on target design rather than release propagation.

## Browser architecture

Milestone 0 uses no framework and no backend:

```text
index.html
  └── src/app.mjs
        ├── src/engine.mjs
        └── src/catalog.mjs
```

Benefits at this stage:

- deploy directly to GitHub Pages;
- no bundler/runtime lock-in while the domain evolves;
- identical engine module can be imported by Node tests;
- easy to inspect, fork and contribute.

A framework may be introduced later only when interaction complexity justifies it.

## Determinism requirements

Given the same:

- normalized context;
- catalog version;
- rule version;

…the normalized composition result must be stable.

Requirements:

- stable IDs;
- explicit sort order before serialization;
- no wall-clock data inside core result;
- no random IDs;
- no network calls inside composition;
- no LLM calls inside authoritative rule execution.

## AI boundary

Future optional flow:

```text
free text
   ↓
LLM-assisted extraction
   ↓
proposed structured context
   ↓
human review
   ↓
validated context
   ↓
deterministic composer
```

This gives AI a useful role without making architecture output irreproducible.

## Security / privacy

The public demo must run locally in the browser and send no company context to a backend. Future connectors/imports require explicit network actions and provenance. Export should support removing organization-identifying fields before sharing.

## Versioning direction

Separate versions are expected for:

- Composer application/CLI version;
- context schema;
- blueprint schema;
- reference packs;
- rule packs;
- ecosystem compatibility adapters.

Version boundaries should be introduced before external consumers depend on the formats; do not prematurely freeze the initial prototype structures.