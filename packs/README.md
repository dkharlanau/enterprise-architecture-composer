# Architecture pack catalog

Architecture packs are optional advisory overlays over Enterprise Architecture Composer's stable vendor-neutral core.

| Pack | Kind | Status | Purpose |
| --- | --- | --- | --- |
| [`industry-automotive.pack.json`](industry-automotive.pack.json) | Industry | reference fixture | Adds explicitly heuristic automotive manufacturing guidance to existing process/capability IDs. |
| [`vendor-sap.pack.json`](vendor-sap.pack.json) | Vendor | reference fixture | Adds illustrative SAP implementation mappings/options without changing core recommendations. |

Validate the catalog:

```bash
npm run packs:validate
```

Compose the manufacturing reference scenario with both overlays:

```bash
npm run packs:demo
```

Pack output is intentionally separated from the normal architecture composition. Loading a pack never gives it ownership of core rules or stable core IDs.

See [`docs/ARCHITECTURE_PACKS.md`](../docs/ARCHITECTURE_PACKS.md) for the authoring, evidence, alias, versioning, and contribution contract.
