# Enterprise Architecture Composer

**Configure the business. Compose the architecture. Explain every decision.**

Enterprise Architecture Composer turns a structured business context into an explainable target architecture blueprint and an implementation roadmap.

It is not another diagram editor, CMDB, application portfolio repository, or process modeler. The core question is different:

> Given this business model, process scope, existing landscape and constraints, what architecture should we build — and why?

The first public slice focuses on a global B2B manufacturing company. A user selects business processes, operating constraints and existing systems; the composer deterministically derives capabilities, system responsibilities, integration needs, data ownership, architecture gaps and work packages.

## Try the reference scenario

The browser workbench is zero-backend and can be served from the repository root. The same core also runs from Node:

```bash
npm test
node bin/eac.mjs compose examples/scenarios/global-b2b-manufacturer.context.json
node bin/eac.mjs compose examples/scenarios/global-b2b-manufacturer.context.json --output blueprint.json
node bin/eac.mjs compare \
  examples/scenarios/o2c-starter.context.json \
  examples/scenarios/global-b2b-manufacturer.context.json
```

No runtime package install is required for the current alpha.

## Product loop

```text
Enterprise context
  industry / operating model / processes / scale / current landscape / constraints
                                 │
                                 ▼
                         deterministic rules
                                 │
               ┌─────────────────┼─────────────────┐
               ▼                 ▼                 ▼
         target blueprint   decision trace    architecture gaps
               │                 │                 │
               └─────────────────┼──────────────────┘
                                 ▼
                         delivery work packages
                                 │
             ┌───────────────────┼────────────────────┐
             ▼                   ▼                    ▼
       Process as Code    Interface as Code     Visual Workbench

baseline scenario ───────┐
                         ├── deterministic delta ──> impact seeds
changed context ─────────┘
```

## What the composer owns

The composer owns **proposal semantics**: input context, catalog selections, architecture recommendations, rule traces, unresolved questions, scenario deltas and generated work-package proposals.

It deliberately does not become the long-term semantic owner of every downstream artifact:

- maintained process semantics belong in [Process as Code](https://github.com/dkharlanau/process-as-code);
- operational integration contracts belong in [Interface as Code](https://github.com/dkharlanau/interface-as-code);
- field/value transformation intent belongs in [Mapping as Code](https://github.com/dkharlanau/mapping-as-code);
- change-specific impact analysis belongs in [Enterprise Change Graph](https://github.com/dkharlanau/enterprise-change-graph);
- presentation/rendering can be delegated to [Visual Workbench](https://github.com/dkharlanau/visual-workbench).

This keeps the composer useful as an architecture synthesis layer instead of turning it into a universal writable enterprise graph.

## Design principles

1. **Intent in, explainable blueprint out.** Every recommendation must expose the facts and rules that caused it.
2. **Deterministic before AI.** The reference composer works without an LLM. AI may later help structure input, but it does not become the source of truth.
3. **Vendor-neutral core.** Vendor and industry mappings are optional packs over stable core concepts.
4. **One coherent scenario before broad coverage.** The first reference pack is manufacturing, not a shallow encyclopedia of thousands of products.
5. **Unknown is a valid result.** Conflicting or missing requirements become explicit architecture questions instead of guessed answers.
6. **No vanity architecture score.** Prefer concrete coverage/gap metrics and categorical decisions over opaque weighted scores.
7. **Current and target state are different facts.** Future migration support must represent keep/introduce/replace/retire semantics explicitly.
8. **Rendering is a boundary.** Composition semantics are independent from the visual engine.

## First reference scenario

A global B2B manufacturer with multiple legal entities, plants and warehouses can compose a blueprint across:

- Order to Cash
- Procure to Pay
- Plan to Produce
- Returns
- Intercompany
- Record to Report

Reference system roles include CRM, ERP, MDM, WMS, MES, TMS, Integration Platform, Data Platform and Partner Edge. Core data objects include Customer, Product/Material, Supplier, Price, Sales Order, Purchase Order, Delivery, Inventory, Production Order and Invoice.

The first integration decision model distinguishes synchronous API, asynchronous message, domain event, EDI/B2B, file/batch, CDC/replication and ETL/ELT using explicit drivers such as latency, fan-out, volume, consistency, replay and partner boundaries.

## Current executable surface

```text
src/
  catalog.mjs       manufacturing reference knowledge
  rulebook.mjs      versioned architecture rule inventory
  engine.mjs        deterministic composition rules
  diff.mjs          baseline → target architecture delta
  app.mjs           browser workbench
bin/
  eac.mjs           compose + compare CLI
schemas/
  context.schema.json
  blueprint.schema.json
examples/scenarios/ three materially different reference contexts
tests/              engine + rules + golden + diff + static smoke fixtures
styles.css          product visual system
index.html          zero-backend public app
.github/workflows/  CI + Pages deployment workflow
```

The workbench has five projections over the same composition: **Blueprint**, **Integrations**, **Data**, **Roadmap**, and **Delta**. `Set baseline` freezes the current composition; changing scope or constraints then shows added, removed and changed architecture/delivery objects. Selecting an architecture object opens its recommendation trace, rule IDs, findings and delivery impact.

## Contract and rule discipline

- Context and result formats are published as JSON Schema drafts under `schemas/`.
- `src/rulebook.mjs` currently defines 30 stable rule IDs; implemented rules are explicitly distinguished from experimental contracts.
- Three reference scenario files are exercised by CI.
- Golden tests make architecture-count drift explicit during review.
- Scenario diff never mutates the baseline and emits compact `impactSeeds` for downstream change analysis.
- The engine uses stable IDs, sorted output, no random IDs, no network calls and no wall-clock data.
- `AGENTS.md` defines the autonomous development contract.

## GitHub Pages bootstrap

The repository contains a Pages workflow, but GitHub requires Pages to be enabled once for a brand-new repository. In **Settings → Pages**, choose **GitHub Actions** as the source; then run **Deploy GitHub Pages** from the Actions tab. The first enablement cannot be performed with the workflow's default `GITHUB_TOKEN`.

After bootstrap, the intended project URL is:

`https://dkharlanau.github.io/enterprise-architecture-composer/`

## Backlog

GitHub Issues are the execution source of truth. The foundation already includes the domain model, deterministic synthesis engine, manufacturing catalog, CI/golden fixtures and scenario delta. Remaining P0 work focuses on deeper integration-decision reasoning, roadmap semantics, workbench polish and public Pages verification.

See [`PRODUCT.md`](PRODUCT.md), [`ARCHITECTURE.md`](ARCHITECTURE.md), [`BACKLOG.md`](BACKLOG.md), [`AGENTS.md`](AGENTS.md), the [`schemas/`](schemas/) and [`examples/scenarios/`](examples/scenarios/) directories.

## Status

**Executable early alpha.** The deterministic engine, manufacturing reference catalog, browser workbench, scenario comparison, CLI, schemas, rulebook and CI are implemented. GitHub Pages activation is the remaining manual bootstrap step before the public demo URL can be verified.

MIT License.