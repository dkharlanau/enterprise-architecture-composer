# Architecture packs

Architecture packs extend Enterprise Architecture Composer without changing the semantic ownership of the core model.

A pack is an **advisory overlay** over stable Composer IDs. It can contribute aliases, evidence-backed guidance, and implementation options. It cannot define, replace, disable, reorder, or weight core composition rules.

## Why the boundary is strict

The core Composer answers a vendor-neutral question: given a business scope and explicit constraints, what responsibilities, flows, data ownership decisions, trust boundaries, and delivery work are implied?

A pack answers a later question: given that stable architecture, what industry guidance or implementation options should reviewers consider?

Keeping these questions separate prevents three failure modes:

1. an industry pack silently changing the base architecture;
2. a vendor pack turning a product mapping into a hidden recommendation;
3. commercial preference being mistaken for technical fit.

## Pack contract

Pack files validate against [`schemas/architecture-pack.schema.json`](../schemas/architecture-pack.schema.json) and use:

```json
{
  "format": "enterprise-architecture-composer/architecture-pack",
  "formatVersion": "0.1",
  "pack": {
    "id": "pack.industry.example",
    "version": "0.1.0",
    "kind": "industry",
    "name": "Example industry pack",
    "description": "A bounded advisory extension over stable Composer IDs."
  },
  "evidence": [],
  "aliases": [],
  "guidance": [],
  "options": []
}
```

Pack IDs must start with `pack.industry.` or `pack.vendor.`. Every record inside the pack must be namespaced under that pack ID. Record IDs are semantic contracts and should not be recycled for different meanings.

## What a pack may contain

### Evidence

Every guidance statement and every implementation option must point to evidence declared inside the same pack.

Supported evidence types are:

- `standard` — a named external standard;
- `vendor-docs` — vendor-published product documentation;
- `internal-methodology` — a documented mapping or review method owned by the pack author;
- `heuristic` — explicitly heuristic guidance.

Do not label internal experience as a standard or vendor fact. A guidance record classified as `fact` is rejected unless at least one source is `standard` or `vendor-docs`.

### Aliases

Aliases can map industry or vendor vocabulary to an existing stable Composer ID. They cannot:

- introduce a new core concept;
- remap an alias that already resolves to another core object;
- reuse a globally ambiguous core alias such as `warehouse`;
- collide with another loaded pack that maps the same alias to a different target.

If a new semantic concept is genuinely required, it belongs in a reviewed core-catalog change rather than an alias trick.

### Guidance

Guidance is advisory and can target one or more existing core IDs. Classification is explicit:

- `fact` — externally evidenced fact;
- `heuristic` — bounded architecture heuristic;
- `vendor-mapping` — mapping between a vendor concept/product and a stable Composer concept.

`vendor-mapping` is allowed only in a vendor pack. Guidance never becomes a core rule.

### Implementation options

A vendor or industry pack may offer candidate implementations for stable Composer capabilities, system roles, or integration patterns.

Every option separates two dimensions:

```json
{
  "fitEvidence": [
    {
      "statement": "Why this option maps to the stable responsibility.",
      "sourceIds": ["pack.vendor.example.evidence.mapping"]
    }
  ],
  "commercialPreference": {
    "status": "none"
  }
}
```

`fitEvidence` explains technical/semantic fit. `commercialPreference` records a separate owner or commercial preference when one actually exists. A product does not become preferred merely because it appears in a vendor pack.

There is deliberately no aggregate option score in the pack contract.

## Core ownership and versioning

Composer core owns:

- stable process, capability, system-role, data-object, and integration-pattern IDs;
- deterministic composition rules and rule IDs;
- NFR, security, transition, diagnostics, and delivery semantics;
- public schemas for core input/output.

A pack may reference these IDs but cannot redefine them. Pack versions are independent semantic versions. A pack upgrade must not require a hidden core-rule override.

When a pack needs a new core concept, open a core issue with fixtures and explain why the existing glossary cannot represent it unambiguously.

## Coexistence

Multiple industry and vendor packs can be loaded together. They are merged as review overlays, not through last-write-wins mutation.

If two vendor packs both offer an ERP implementation for `sys.erp`, both options remain visible. If two packs try to assign the same alias to different core IDs or reuse the same semantic record ID, validation fails.

The core composition works identically when zero packs are loaded.

## CLI

Validate one or more packs:

```bash
node bin/eac-packs.mjs validate \
  packs/industry-automotive.pack.json \
  packs/vendor-sap.pack.json
```

Compose a normal scenario and attach advisory pack overlays:

```bash
node bin/eac-packs.mjs compose \
  examples/scenarios/global-b2b-manufacturer.context.json \
  packs/industry-automotive.pack.json \
  packs/vendor-sap.pack.json
```

The result contains two independent sections:

- `composition` — normal Composer output;
- `packOverlay` — active pack metadata, matching guidance, aliases, and implementation options.

## Included reference fixtures

- [`packs/industry-automotive.pack.json`](../packs/industry-automotive.pack.json) — heuristic automotive manufacturing guidance;
- [`packs/vendor-sap.pack.json`](../packs/vendor-sap.pack.json) — illustrative SAP implementation mappings.

The SAP fixture deliberately uses `internal-methodology` evidence rather than pretending the mappings are SAP documentation. Its product options use `commercialPreference: none` by default.

## Contribution checklist

Before submitting a pack:

1. Validate it with `eac-packs validate`.
2. Keep every record ID inside the pack namespace.
3. Reference existing stable Composer target IDs only.
4. Add provenance for every guidance statement and option.
5. Distinguish facts, heuristics, and vendor mappings accurately.
6. Keep technical fit separate from commercial preference.
7. Add positive and negative fixtures for aliases/references.
8. Prove the core composition is unchanged with the pack loaded.
9. Never include client names, proprietary landscapes, credentials, or confidential implementation facts.
10. Do not add a `rules` section; pack-defined core rules are intentionally unsupported.
