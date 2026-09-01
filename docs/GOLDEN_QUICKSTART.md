# Golden quickstart — v0.2.1

This walkthrough proves the released deterministic core with a synthetic manufacturing context. It does not approve the proposed architecture.

## Run from the release tag

Requirements: Git and Node.js 24.

```bash
git clone --branch v0.2.1 --depth 1 \
  https://github.com/dkharlanau/enterprise-architecture-composer.git
cd enterprise-architecture-composer

npm run check
npm test
node bin/eac.mjs compose \
  examples/scenarios/global-b2b-manufacturer.context.json \
  > /tmp/eac-v0.2.1-blueprint.json
```

Verify the byte-stable result:

```bash
node -e 'const fs=require("node:fs"); const c=require("node:crypto"); const p="/tmp/eac-v0.2.1-blueprint.json"; const actual=c.createHash("sha256").update(fs.readFileSync(p)).digest("hex"); const expected="ae79fad940be7b008d2c07880d3bb760d49d3947e7985349a7c05f50a01ae2b4"; if(actual!==expected) throw new Error(`${actual} != ${expected}`); console.log(`verified ${actual}`)'
```

Then inspect rather than merely accepting the output:

```bash
node bin/eac.mjs report \
  examples/scenarios/global-b2b-manufacturer.context.json \
  --output /tmp/eac-v0.2.1-review.md
```

The expected review includes explicit recommendations, findings, unresolved decisions, and work-package dependencies. A matching digest proves reproducibility for the released fixture and supported runtime, not architecture fitness for another organization.
