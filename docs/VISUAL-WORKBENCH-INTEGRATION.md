# Rendering Composer output with Visual Workbench

Enterprise Architecture Composer owns the deterministic architecture proposal, stable source IDs and decision trace. Visual Workbench owns visual layout and SVG/HTML presentation. The integration transfers a coordinate-free projection; it does not duplicate architecture semantics in a drawing model.

## Tested workflow

The compatibility workflow pins Visual Workbench commit `5663fac2a92b85917f0911018e3bd61d180be59b`. CI generates a real manufacturing projection, validates all four named views through the downstream parser, and renders the executive view to SVG. This is evidence for that exact baseline, not a claim of compatibility with every past or future Visual Workbench revision.

With both repositories checked out next to each other:

```bash
# Build the downstream renderer.
npm ci --prefix ../visual-workbench
npm run build --prefix ../visual-workbench

# Export a coordinate-free Composer model.
node bin/eac.mjs visual \
  examples/scenarios/global-b2b-manufacturer.context.json \
  --markdown \
  --output architecture.visual.md

# Validate before rendering.
node ../visual-workbench/dist/cli.js validate architecture.visual.md

# Render one named projection.
node ../visual-workbench/dist/cli.js render architecture.visual.md \
  --view executive \
  --output architecture-executive.svg
```

Available named views are `executive`, `integration`, `data` and `exceptions`. Run `node ../visual-workbench/dist/cli.js views architecture.visual.md` to inspect them before choosing a render.

## Contract boundary

- Composer IDs remain node IDs in the visual model.
- Composer emits semantic node types, relationships, groups, statuses and named views, but never coordinates or colors.
- Visual Workbench may change layout without changing the Composer result.
- The projection is a presentation handoff, not a new architecture source of truth.
- A rendered diagram does not resolve open findings or approve recommendations.

If a downstream release changes its metadata language, update the pinned compatibility baseline only after this workflow passes against the new revision.
