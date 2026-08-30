# Product Strategy

## Product thesis

Enterprise architecture tools are good at describing, cataloging and visualizing an enterprise once the model exists. The harder starting question is often less well served:

> We know the business outcome, process scope, current systems and constraints. What target architecture is implied by those facts, which decisions are still unresolved, and what work is required to get there?

Enterprise Architecture Composer is an **architecture synthesis and planning tool**. It turns structured intent into an explainable blueprint proposal.

## Primary user

The first user is a solution / enterprise architect working before or during a transformation initiative who needs to convert fragmented workshop inputs into a coherent target design.

Secondary users:

- business process owners who need a readable view of how capabilities and processes map to systems;
- integration/data architects who need explicit integration and ownership decisions;
- delivery leads who need architecture decisions translated into work packages;
- consultants who need a reproducible starting point rather than a new blank slide deck for every project.

## Jobs to be done

### 1. Start a solution design

**When** I have a business scope but no agreed target architecture,
**I want** to configure the relevant context and constraints,
**so that** I get a defensible first blueprint instead of starting from empty canvas.

### 2. Challenge a design

**When** a proposed architecture exists,
**I want** to see unsupported capabilities, missing integrations, unclear data ownership and unresolved NFR decisions,
**so that** review focuses on concrete gaps.

### 3. Explore a change

**When** we consider replacing a system, adding a country or changing an integration style,
**I want** a scenario delta,
**so that** I understand architectural and delivery consequences before committing.

### 4. Start delivery

**When** the blueprint is accepted,
**I want** architecture-derived work packages and starter domain artifacts,
**so that** the design does not end as an isolated diagram.

## Product boundary

The product should not try to win by replicating established enterprise repositories.

- SAP LeanIX: strong enterprise inventory, business capabilities, application portfolio and transformation planning.
- Ardoq: strong graph-based EA repository, visualization and scenario modeling.
- Backstage: strong software ecosystem catalog organized through domains, systems, components, APIs and resources.
- SAP Signavio: strong process modeling, intelligence and transformation management.
- ArchiMate: an open modeling language for describing enterprise architecture concepts and relationships.

Composer can interoperate with these concepts, but its differentiator is **derivation**: creating and explaining a target proposal from intent and constraints.

### We are not

- a CMDB;
- an application portfolio management product;
- a BPMN editor;
- an integration runtime;
- a universal enterprise graph;
- an LLM architecture chatbot;
- a product recommendation affiliate catalog.

### We are

- a structured architecture intake;
- a deterministic recommendation/rule engine;
- a reference architecture catalog with versioned packs;
- a gap/decision detector;
- a scenario composer;
- a work-package generator;
- a handoff layer into authoritative domain tools.

## Core product contract

### Input

```yaml
enterprise:
  industry: manufacturing
  operating_model: b2b
  countries: 8
  legal_entities: 12
  plants: 4
  warehouses: 11
scope:
  processes:
    - order-to-cash
    - procure-to-pay
    - plan-to-produce
constraints:
  high_volume: true
  multi_company: true
  retain_legacy_wms: true
existing:
  systems:
    - erp
    - legacy-wms
```

### Output

```yaml
blueprint:
  capabilities: []
  processes: []
  systems: []
  integrations: []
  data_objects: []
recommendations:
  - id: integration.order-created
    decision: domain-event
    confidence: high
    because:
      - downstream consumers do not need to block order acceptance
      - high volume favors decoupled processing
    rule_ids:
      - INT-EVENT-001
gaps: []
work_packages: []
```

`confidence` is categorical and rule-defined. It is not a probabilistic claim.

## Recommendation hierarchy

The product should distinguish four outputs instead of blending them:

1. **Required** — directly implied by selected scope or a hard constraint.
2. **Recommended** — preferred by an explicit rule when alternatives remain valid.
3. **Question** — insufficient/conflicting information requires a human decision.
4. **Finding** — the composed architecture currently violates a quality rule or has a coverage gap.

This is more useful than one list of AI suggestions.

## First wedge: manufacturing architecture starter

The first release should be useful to a real architecture workshop for a B2B manufacturer.

It should answer questions such as:

- Which capability groups are required by O2C/P2P/Plan-to-Produce?
- Which logical system responsibilities must exist?
- Which business objects cross system boundaries?
- Where is a synchronous response genuinely required?
- Where should downstream processing be asynchronous?
- Which flows need reconciliation/replay concepts?
- Which objects need explicit system-of-record ownership?
- What changes when the enterprise is multi-company?
- What implementation packages follow from the target design?

## UX direction

The product should feel like an architecture workbench, not a generic SaaS admin dashboard.

### Composition

Three persistent areas:

1. **Context rail** — user intent and constraints.
2. **Architecture canvas** — the system being composed.
3. **Decision rail** — explanations, gaps and delivery consequences.

### Visual grammar

- technical editorial typography;
- a subtle planning-grid surface;
- architecture blocks with strong labels and minimal decoration;
- small semantic chips for current/proposed, required/recommended and lifecycle state;
- line/connector hierarchy that makes primary business flow easy to scan;
- one restrained accent color for active composition, separate alert semantics for findings;
- no decorative AI gradients, glowing cards or chat-first layout.

### Views

The same blueprint should project into:

- **Blueprint** — capabilities + systems + principal relationships;
- **Integrations** — source/target/data/pattern and why;
- **Data** — system-of-record and movement;
- **Roadmap** — work packages and dependencies;
- later **Scenario Delta** — before/after impact.

## Adoption model

### 30 seconds

Open the public demo and see a preconfigured manufacturing blueprint.

### 5 minutes

Change process scope or constraints and understand why architecture elements appear/disappear.

### 30 minutes

Build a project starter and export the blueprint/report.

### Team adoption

Export adopted process/interface proposals into the corresponding as-code repositories and keep architecture scenarios in Git.

## Success metrics

Avoid vanity traffic metrics as product success criteria. Measure whether the product can produce useful, reviewable artifacts.

Early measures:

- percentage of reference rules with deterministic fixtures;
- percentage of generated elements with a visible rationale;
- number of unresolved questions detected rather than silently guessed;
- time to compose a coherent reference architecture from a known scenario;
- percentage of blueprint elements exportable with stable IDs/provenance;
- number of independently usable industry/vendor packs later.

## Strategic moat

The defensible part is not the canvas. It is the **versioned architecture knowledge layer**:

- stable semantic IDs;
- coherent reference catalogs;
- deterministic, explainable decision rules;
- scenario history;
- cross-repository handoff contracts;
- evidence/provenance for how architecture guidance evolves.

The UI makes that knowledge usable; the knowledge model is the product core.