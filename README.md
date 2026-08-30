# Enterprise Architecture Composer

**Configure the business. Compose the architecture. Explain every decision.**

Enterprise Architecture Composer turns a structured business context into an explainable target architecture blueprint and an implementation roadmap.

It is not another diagram editor, CMDB, application portfolio repository, or process modeler. The core question is different:

> Given this business model, process scope, existing landscape and constraints, what architecture should we build — and why?

The first public slice focuses on a global B2B manufacturing company. A user selects business processes, operating constraints and existing systems; the composer deterministically derives capabilities, system responsibilities, integration needs, data ownership, architecture gaps and work packages.

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
               └─────────────────┼─────────────────┘
                                 ▼
                         delivery work packages
                                 │
             ┌───────────────────┼────────────────────┐
             ▼                   ▼                    ▼
       Process as Code    Interface as Code     Visual Workbench
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

## Repository direction

The implementation starts deliberately small and portable:

```text
src/
  catalog.mjs       reference capabilities, processes, systems and data
  engine.mjs        deterministic composition rules
  app.mjs           browser workbench
styles.css          product visual system
index.html          zero-backend public app
tests/              Node built-in deterministic tests
docs/               product, architecture and design decisions
.github/workflows/   CI and GitHub Pages
```

No framework is required for the first vertical slice. That keeps the public demo easy to run, fork and deploy while the domain model is still changing.

## Backlog

The detailed implementation backlog is maintained as GitHub Issues. The P0 sequence is:

1. domain model and stable IDs;
2. deterministic synthesis engine;
3. coherent manufacturing reference catalog;
4. interactive architecture workbench;
5. integration-pattern decision model;
6. implementation work-package generation;
7. CI/fixtures and public GitHub Pages.

See [`PRODUCT.md`](PRODUCT.md), [`ARCHITECTURE.md`](ARCHITECTURE.md), [`BACKLOG.md`](BACKLOG.md) and [`AGENTS.md`](AGENTS.md).

## Status

**Foundation / early alpha.** The repository is being built as an executable product rather than a documentation-only concept. The first milestone is a useful manufacturing blueprint composer that runs entirely in the browser and has deterministic test fixtures.

MIT license is planned; no licensing claim is made until a LICENSE file is committed.