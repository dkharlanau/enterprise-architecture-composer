# Enterprise Architecture Composer

**Configure the business. Compose the architecture. Explain every decision.**

Enterprise Architecture Composer turns structured business context and constraints into an explainable target architecture, scenario delta and implementation roadmap.

It is not another diagram editor, CMDB, application portfolio repository or process modeler. Its question is different:

> Given this business model, process scope, existing landscape and non-functional constraints, what architecture should we build — what remains undecided, and why?

The current reference slice models a global B2B manufacturing company. The composer deterministically derives business capabilities, system responsibilities, data ownership, integration needs, architecture findings and delivery work packages. No LLM is required.

## What works now

```text
business context + current landscape + NFRs
                    │
                    ▼
          deterministic composition
                    │
       ┌────────────┼─────────────┐
       ▼            ▼             ▼
   blueprint    decisions       findings
       │            │             │
       └────────────┼─────────────┘
                    ▼
          dependency roadmap
                    │
        ┌───────────┼──────────────┐
        ▼           ▼              ▼
 Process-as-Code  Interface-as-Code  Visual Workbench
      starter       proposal/adopt     projection

baseline ──────┐
               ├── scenario delta ──> impact seeds
changed input ─┘
```

The public Composer surface is currently **v0.2.0**.

## Quick start

No runtime package installation is required for the current alpha.

For the pinned release path and expected output digest, use the [golden quickstart](docs/GOLDEN_QUICKSTART.md).

```bash
npm test

# Compose a target architecture
node bin/eac.mjs compose \
  examples/scenarios/global-b2b-manufacturer.context.json

# Compare two scenarios
node bin/eac.mjs compare \
  examples/scenarios/o2c-starter.context.json \
  examples/scenarios/global-b2b-manufacturer.context.json

# Generate an explainable dependency roadmap
node bin/eac.mjs roadmap \
  examples/scenarios/global-b2b-manufacturer.context.json \
  --markdown

# Create a portable Git-reviewable bundle
node bin/eac.mjs bundle \
  examples/scenarios/global-b2b-manufacturer.context.json \
  --output architecture.bundle.json

# Produce a human architecture review report
node bin/eac.mjs report \
  examples/scenarios/global-b2b-manufacturer.context.json \
  --output architecture-report.md

# Emit the same model for Visual Workbench
node bin/eac.mjs visual \
  examples/scenarios/global-b2b-manufacturer.context.json \
  --output architecture.visual.json
```

## Architecture decisions, not technology guesses

Integration recommendations use explicit drivers rather than vendor preference or a hidden score:

- latency;
- consistency;
- volume;
- fan-out;
- ordering;
- replay;
- offline tolerance;
- partner boundary;
- payload size;
- change frequency;
- business purpose.

The decision kernel evaluates synchronous API, asynchronous message, domain event, EDI/B2B, file/batch, CDC/replication and ETL/ELT.

A result is categorical: `preferred`, `acceptable`, `disfavored` or `incompatible`. Each option carries reasons and trade-offs. If requirements conflict — for example immediate final response plus extended offline tolerance — Composer emits an unresolved architecture decision instead of hiding the conflict behind a technology choice.

Global and per-flow NFR profiles are part of the public context contract:

```json
{
  "processes": ["order-to-cash"],
  "nfrProfile": {
    "volume": "high",
    "replay": "desirable"
  },
  "integrationProfiles": {
    "integration.delivery-to-warehouse": {
      "latency": "hours",
      "consistency": "snapshot",
      "payloadSize": "very-large",
      "offlineTolerance": "extended"
    }
  }
}
```

An explicit NFR profile may challenge the catalog-default pattern. Composer then creates a finding for human confirmation; it does **not** silently rewrite the architecture.

## Human decisions remain separate from proposals

Accepted, rejected and overridden recommendations can be recorded in the input context without changing the original Composer proposal:

```json
{
  "processes": ["order-to-cash"],
  "architectureDecisions": [
    {
      "recommendationId": "rec.integration.sales-order-request",
      "status": "overridden",
      "selectedDecision": "pattern.async-message",
      "rationale": "The approved channel accepts asynchronous confirmation and prioritizes outage isolation."
    }
  ]
}
```

The result retains the proposed decision, the effective human decision and a snapshot of the source recommendation. If later context no longer produces that recommendation, Composer emits explicit decision drift instead of discarding the prior record. Portable bundles preserve the same decision history.

## Current landscape imports

The import module accepts application/interface CSV inventories, annotated Backstage entities and existing Process-as-Code or Interface-as-Code artifacts. Imported data becomes current-state evidence and constraints; it never becomes a target recommendation automatically.

Examples are available under [`examples/import/`](examples/import/). Ambiguous role aliases, missing endpoints and conflicting instance facts remain explicit import conflicts. The merge step preserves existing context rather than overwriting it silently.

## Delivery roadmap

A composed architecture can be projected into an implementation roadmap with deterministic dependency waves.

Every package contains:

- stable work-package ID;
- phase;
- mandatory or conditional classification;
- trigger;
- rationale;
- source architecture objects;
- dependencies;
- deterministic execution wave;
- reusable labels for later GitHub/Jira handoff.

Conditional work is explicit. For example, legacy-WMS coexistence exists only when the context says that the WMS must be retained.

## What-if analysis

The browser workbench and CLI support baseline → target comparison.

```text
added / removed / changed
  processes
  capabilities
  systems
  integrations
  data ownership
  findings
  work packages
```

The delta keeps rule/reason traces and emits compact `impactSeeds`, creating a clean future handoff to [Enterprise Change Graph](https://github.com/dkharlanau/enterprise-change-graph).

## Portable architecture bundle

`eac bundle` creates a deterministic, Git-reviewable architecture package containing:

- normalized context;
- engine/catalog/schema versions;
- complete blueprint;
- recommendations and findings;
- delivery roadmap;
- privacy mode.

Shareable bundles whitelist known Composer context fields instead of copying arbitrary company metadata. Re-import is tested by recomposing the context and verifying semantic equivalence with the stored blueprint, including explicit NFR profiles.

## Governed downstream handoff

Composer owns **proposal semantics**, not permanent downstream truth.

### Process as Code

```bash
node bin/eac.mjs process-starter \
  examples/scenarios/global-b2b-manufacturer.context.json \
  order-to-cash \
  --output order-to-cash.process.json
```

The generated Process-as-Code v0.2 starter preserves process ID, capabilities, systems, data objects, interface scope and Composer provenance. It deliberately contains a non-executable `refine_process_flow` subprocess instead of inventing human tasks, approvals or gateways the architecture catalog does not know.

After adoption, maintained process semantics belong to [Process as Code](https://github.com/dkharlanau/process-as-code).

### Interface as Code

Integration handoff is deliberately two-stage:

```bash
# 1. Export what Composer actually knows plus unresolved operational decisions
node bin/eac.mjs interface-proposal \
  examples/scenarios/global-b2b-manufacturer.context.json \
  integration.sales-order-request \
  --output proposal.json

# 2. Add explicit adoption decisions and create the Interface-as-Code contract
node bin/eac.mjs interface-adopt \
  proposal.json \
  examples/handoff/interface-adoption-decisions.sample.json \
  --output interface.json
```

The proposal does not invent delivery guarantees, idempotency, retry, monitoring ownership or reconciliation semantics. Only after those required decisions are supplied does Composer emit an Interface-as-Code v1.0-compatible proposed contract with design provenance.

After adoption, the operational contract belongs to [Interface as Code](https://github.com/dkharlanau/interface-as-code).

## Visual boundary

Composer can emit a coordinate-free projection using the published semantic vocabulary of [Visual Workbench](https://github.com/dkharlanau/visual-workbench).

Named projections include:

- executive architecture;
- integration landscape;
- data ownership;
- open architecture decisions.

Composer source IDs remain Visual Workbench node IDs, so rendering can evolve without creating a second semantic source of truth.

The end-to-end [rendering workflow](docs/VISUAL-WORKBENCH-INTEGRATION.md) is tested against a pinned Visual Workbench revision. It validates the emitted Markdown with the real downstream parser and renders an executive SVG in CI; this is a versioned compatibility baseline, not an open-ended compatibility claim.

## Browser workbench

The zero-backend workbench currently exposes five views over one composition:

**Blueprint · Integrations · Data · Roadmap · Delta**

The UX is intentionally closer to an engineering workbench than a generic AI dashboard: context on the left, composed architecture in the center and explanation/decision trace on the right.

`Set baseline` freezes the current scenario; changing processes or constraints then exposes the architecture delta.

The browser UI still needs its next polish pass to expose the complete v0.2 NFR/handoff surface directly. The CLI and deterministic modules are currently ahead of the browser controls.

## Reference manufacturing catalog

The first coherent slice covers:

- Order to Cash;
- Procure to Pay;
- Plan to Produce;
- Returns;
- Intercompany;
- Record to Report.

Reference responsibilities include CRM, ERP, MDM, WMS, MES, TMS, Integration Platform, Data Platform and Partner Edge. Core data objects include Customer, Product/Material, Supplier, Price, Sales Order, Purchase Order, Delivery, Inventory, Production Order and Invoice.

The core remains vendor-neutral. SAP, Microsoft, Salesforce and industry-specific mappings are planned as separate packs rather than being embedded into the composition language.

## Repository map

```text
src/
  catalog.mjs                 manufacturing reference knowledge
  rulebook.mjs                versioned architecture rule inventory
  engine.mjs                  stable v0.1 deterministic foundation
  composer.mjs                public v0.2 NFR-aware composition layer
  integration-decision.mjs    explainable pattern comparison
  roadmap.mjs                 dependency waves + rationale
  diff.mjs                    baseline → target architecture delta
  export.mjs                  portable bundles + decision reports
  visual-projection.mjs       Visual Workbench semantic projection
  handoff.mjs                 Process/Interface downstream handoff
  app.mjs                     zero-backend browser workbench

bin/eac.mjs                   public CLI
schemas/                      context + blueprint contracts
examples/scenarios/           materially different reference contexts
examples/handoff/             explicit adoption-decision examples
tests/                        unit, golden, roundtrip, CLI and static smoke tests
index.html + styles.css        public browser product
.github/workflows/             CI + manual-bootstrap Pages deployment
```

## Contract and rule discipline

- Context and result formats are published under `schemas/`.
- The public rulebook inventories every stable rule ID and distinguishes implemented guidance from experimental contracts.
- Three reference scenarios are protected by golden architecture summaries.
- High-volume analytics, NFR bundle round-trip and downstream handoff have explicit regression tests.
- The public CLI is tested end to end.
- Core composition uses stable IDs, sorted results, no random IDs, no network calls and no wall-clock data.
- Unknowns remain unknown until a human or authoritative downstream source resolves them.

## Product boundaries

The Composer does not become a universal writable enterprise graph.

- Process semantics → [Process as Code](https://github.com/dkharlanau/process-as-code)
- Integration operations → [Interface as Code](https://github.com/dkharlanau/interface-as-code)
- Mapping semantics → [Mapping as Code](https://github.com/dkharlanau/mapping-as-code)
- Change-specific impact → [Enterprise Change Graph](https://github.com/dkharlanau/enterprise-change-graph)
- Rendering → [Visual Workbench](https://github.com/dkharlanau/visual-workbench)

This repository remains the synthesis and architecture-decision layer above those specialized artifacts.

## GitHub Pages

The repository publishes the zero-backend workbench from `main` through GitHub Actions:

`https://dkharlanau.github.io/enterprise-architecture-composer/`

## Status

**v0.2 executable alpha.** Deterministic composition, NFR-aware integration decisions, scenario delta, dependency roadmap, portable review bundles, Process-as-Code starter handoff, Interface-as-Code proposal/adoption handoff, Visual Workbench projection and CI are implemented.

The next product loop is browser-workbench v0.2 parity, richer diagnostics/current→transition→target semantics and downstream adoption feedback beyond the pinned Visual Workbench rendering baseline.

See [`PRODUCT.md`](PRODUCT.md), [`ARCHITECTURE.md`](ARCHITECTURE.md), [`BACKLOG.md`](BACKLOG.md), [`AGENTS.md`](AGENTS.md), [`schemas/`](schemas/) and [`examples/`](examples/).

Release and adoption resources:

- [v0.2.0 release notes](release/v0.2.0.md)
- [release policy and compatibility boundary](docs/RELEASES.md)
- [15-minute external usability test](docs/USABILITY_TEST_15_MIN.md)
- [contribution and feedback guide](CONTRIBUTING.md)
- [changelog](CHANGELOG.md)

## Related projects

- [Visual Workbench](https://github.com/dkharlanau/visual-workbench) is the tested rendering boundary for Composer's coordinate-free projection. See the pinned [integration workflow](docs/VISUAL-WORKBENCH-INTEGRATION.md) for the exact compatibility evidence.
- [Process as Code](https://github.com/dkharlanau/process-as-code) and [Interface as Code](https://github.com/dkharlanau/interface-as-code) own downstream process and operational interface semantics after an explicit handoff; Composer remains the proposal and architecture-decision layer.
- [Agent-Ready Web Profile](https://github.com/dkharlanau/agent-ready-web-profile) can describe the Composer Pages schemas and examples as public data surfaces. It does not validate architecture quality or approve Composer recommendations.
- [AI CV Builder](https://github.com/dkharlanau/ai-cv-builder) is a separate professional-profile publisher. There is no model exchange between it and Composer.

## License

MIT. See [`LICENSE`](LICENSE).

## About the author

Created and maintained by **Dzmitryi Kharlanau**, an SAP consultant and system analyst working across enterprise architecture, data, integration, operations, and practical AI.

- [Website and knowledge base](https://dkharlanau.github.io/)
- [LinkedIn](https://www.linkedin.com/in/dkharlanau/)
