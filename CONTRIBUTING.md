# Contributing

Contributions are welcome when they improve deterministic composition, explainability, stable contracts, or adoption evidence.

## Start with the product boundary

Read `AGENTS.md`, `PRODUCT.md`, and `ARCHITECTURE.md`. Composer is not a diagram editor, universal enterprise repository, or architecture approval engine.

Good contributions include a bounded rule with positive and boundary fixtures, a clearer diagnostic, a reproducible import/handoff case, or privacy-safe usability feedback. Do not submit real client landscapes or claims that a recommendation is universally correct.

## Development checks

```bash
npm run check
npm test
node bin/eac.mjs compose \
  examples/scenarios/global-b2b-manufacturer.context.json \
  > /tmp/blueprint.json
```

When behavior changes, update deterministic fixtures and describe compatibility impact. Keep stable IDs unless a documented migration is intentional.

## Feedback paths

- Use the [15-minute usability kit](docs/USABILITY_TEST_15_MIN.md) for an external first-use session.
- File a privacy-safe [usability report](https://github.com/dkharlanau/enterprise-architecture-composer/issues/new?template=usability-feedback.yml).
- Use a normal GitHub issue for a reproducible defect or bounded enhancement.

Never include client names, internal system identifiers, credentials, proprietary exports, or confidential architecture material.
