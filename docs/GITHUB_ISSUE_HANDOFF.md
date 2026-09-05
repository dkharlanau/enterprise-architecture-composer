# GitHub issue handoff

Enterprise Architecture Composer can turn a delivery roadmap into a reviewable GitHub issue plan and, only after explicit approval, apply the missing work packages to an implementation repository.

The handoff is intentionally two-stage:

1. **Plan** — deterministic, network-free preview. No GitHub writes.
2. **Apply** — explicit opt-in, requires an approved plan, `--confirm`, and a GitHub token from an environment variable.

This keeps architecture composition separate from project-management side effects.

## 1. Generate a dry-run plan

```bash
node bin/eac-github-issues.mjs plan \
  examples/scenarios/global-b2b-manufacturer.context.json \
  --repo owner/implementation-repo \
  --output /tmp/eac-issues.json
```

The plan contains proposed issue titles/bodies, labels, phase/wave metadata, source architecture IDs, and dependency work-package IDs.

Without `--approval-ref`, the plan contains:

```json
{
  "readyForApply": false,
  "approvalRef": null
}
```

It cannot be applied.

## 2. Review and approve

After a human architecture/delivery review, regenerate the same plan with a review reference:

```bash
node bin/eac-github-issues.mjs plan \
  examples/scenarios/global-b2b-manufacturer.context.json \
  --repo owner/implementation-repo \
  --approval-ref architecture-review-2026-09-05 \
  --output /tmp/eac-issues-approved.json
```

The approval reference is written into every planned issue together with the Composer engine/catalog versions and plan fingerprint.

## 3. Apply explicitly

Put a token with issue/label write permission in an environment variable. The token is never passed as a CLI argument or written to the plan.

```bash
export GITHUB_TOKEN=...
node bin/eac-github-issues.mjs apply \
  /tmp/eac-issues-approved.json \
  --confirm
```

Apply refuses to run when:

- `--confirm` is absent;
- the plan has no `approvalRef`;
- the token environment variable is missing;
- the plan is not an Enterprise Architecture Composer GitHub issue plan.

## Idempotency

Every generated issue contains a hidden stable marker:

```html
<!-- eac-work-package:wp.integration.sales-order-request -->
```

Before creating anything, apply reads existing open and closed issues and indexes these markers. A work package whose marker already exists is skipped rather than duplicated.

This means a second run of the same approved plan creates zero duplicate work-package issues as long as the marker remains in the issue body.

The marker is deliberately based on the stable Composer work-package ID rather than the issue title. Titles can be edited without breaking idempotency.

## Dependency and phase metadata

Issue bodies retain:

- work-package ID;
- phase;
- mandatory/conditional classification;
- dependency-derived wave;
- trigger and rationale;
- upstream work-package IDs;
- source architecture object IDs;
- Composer engine/catalog versions;
- approval reference and plan fingerprint.

Labels include:

- `eac:work-package`;
- `phase:<phase>`;
- `scope:mandatory` or `scope:conditional`;
- `wave:<n>`;
- specialized work labels such as `work:integration`, `work:security`, `work:migration`, or `work:testing` when present in the roadmap.

GitHub Issues do not provide a universal dependency primitive, so dependency IDs remain explicit check-list metadata in the issue body rather than being falsely represented as native blocking links.

## Library boundary

`src/github-issues.mjs` separates pure planning/reconciliation from the optional GitHub REST adapter:

- `roadmapToGitHubIssuePlan()` — pure deterministic plan;
- `reconcileGitHubIssuePlan()` — pure comparison with existing issue records;
- `applyGitHubIssuePlan()` — side-effect orchestration over an injected adapter;
- `createGitHubRestAdapter()` — optional network implementation used only by explicit apply.

The Composer engine and browser workbench do not call GitHub or require network access.

## Safety and review rule

Do not use the issue handoff to bypass architecture approval. The exported issues are implementation work packages derived from an approved roadmap; they are not proof that an architecture decision is correct, that a security requirement is satisfied, or that a project should execute automatically.
