# Release and compatibility policy

Enterprise Architecture Composer uses Semantic Versioning for its public source releases.

- Patch releases preserve the v0.2 schema shape and stable IDs while fixing defects or documentation.
- Minor releases may add optional context fields, rules, projections, and CLI operations. During `0.x`, consumers must still review release notes before upgrading.
- Major releases may change public schemas or stable identity contracts and require an explicit migration guide.

## Supported release surface

The release contract covers the checked-in Node.js CLI, deterministic core, public schemas, synthetic fixtures, tests, static workbench, and documented handoffs. The v0.2 golden path is tested with Node.js 24; `package.json` permits Node.js 20 or later.

GitHub Releases include a byte-reproducible `npm pack` tarball, a deterministic `git archive` source bundle, and `SHA256SUMS`. The package remains `private` because npm-registry publication is not part of the v0.2 distribution contract.

## Compatibility boundaries

- Visual Workbench compatibility applies only to the revisions exercised by the pinned cross-repository workflow.
- Process and interface outputs are proposals or starters. Their specialist tools own validation and operational adoption.
- Stable IDs are compatibility contracts; presentation order and human-readable wording are not semantic APIs unless documented otherwise.
- No claim is made that a composed proposal is complete, optimal, standards-certified, or approved for production.

See the [golden quickstart](GOLDEN_QUICKSTART.md) and [v0.2.1 release notes](../release/v0.2.1.md).
