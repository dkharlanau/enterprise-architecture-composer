# Agent Development Contract

## Product intent

Enterprise Architecture Composer turns explicit business scope and constraints into an explainable architecture proposal. Preserve that distinction on every change: **this is a composition engine, not a generic diagram editor or universal enterprise repository.**

## Core rules

1. Deterministic composition is authoritative. AI assistance may propose structured input but never bypasses deterministic validation/rules.
2. Every recommendation must retain stable `ruleIds` and a human-readable `because` trace.
3. Never hide missing/conflicting inputs. Emit an explicit question/finding instead of guessing.
4. Keep the vendor-neutral core independent from vendor packs.
5. Stable IDs are contracts. Do not rename IDs casually; add migration/version notes when identity must change.
6. Do not duplicate semantic ownership from Process-as-Code, Interface-as-Code, Mapping-as-Code or Visual Workbench. Composer produces proposals/projections and provenance-bearing handoffs.
7. Do not store x/y coordinates or presentation styling in the composition model.
8. No universal architecture quality score. Prefer defined structural metrics and explicit option comparisons.
9. Public reference data must not imply facts about a real customer/company.
10. No network calls, randomness or wall-clock state inside the deterministic core.

## Agent loop

For autonomous work:

1. Inspect open P0, then P1 issues and their dependencies.
2. Choose the smallest increment that improves an end-to-end user workflow.
3. Implement behavior before polishing documentation.
4. Add or update a deterministic fixture whenever rule behavior changes.
5. Run `npm run check` and `npm test`.
6. Review generated result IDs, reasons, findings and work-package dependencies for semantic regressions.
7. Update docs/schemas only when the contract changed.
8. Close an issue only when its acceptance criteria are materially satisfied.
9. Continue with the next dependency instead of creating speculative breadth.

## Rule changes

A new or changed architecture rule should include:

- stable ID in `src/rulebook.mjs`;
- explicit family and description;
- maturity (`experimental`, `fixture-backed`, `documented`, `stable`);
- deterministic inputs and output;
- positive fixture;
- negative/boundary fixture before `stable`;
- evidence/provenance when based on an external standard/vendor fact.

A rule may remain visible as `implemented: false` while its contract is being designed. Do not mark it implemented until the engine actually executes it.

## UX rules

The workbench must keep three concepts visually distinct:

- **Context** — facts and constraints supplied/approved by the user.
- **Composition** — blueprint elements produced from those facts.
- **Decision trace** — why elements exist, what remains unresolved, and what work follows.

Prefer semantic selection and projections over manual drag/drop. The core product experience should remain useful on a static GitHub Pages deployment.

## Verification

Minimum before merge/commit of semantic changes:

```bash
npm run check
npm test
node bin/eac.mjs compose examples/scenarios/global-b2b-manufacturer.context.json > /tmp/blueprint.json
```

The same normalized context + catalog version + engine version must produce byte-stable `serializeComposition()` output.