import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyGitHubIssuePlan,
  reconcileGitHubIssuePlan,
  roadmapToGitHubIssuePlan,
  workPackageIdFromIssueBody,
  workPackageIssueMarker
} from '../src/github-issues.mjs';

const ROADMAP = {
  schemaVersion: '0.1',
  source: {
    engineVersion: '0.2.0',
    catalogVersion: '0.1.0'
  },
  packages: [
    {
      id: 'wp.architecture.resolve-decisions',
      phase: 'architecture',
      title: 'Resolve architecture decisions',
      classification: 'mandatory',
      wave: 1,
      trigger: 'open decisions exist',
      rationale: 'Resolve assumptions before implementation.',
      dependsOn: [],
      sourceIds: ['finding.example'],
      labels: ['phase:architecture', 'scope:mandatory']
    },
    {
      id: 'wp.integration.order-api',
      phase: 'integration',
      title: 'Implement order integration',
      classification: 'mandatory',
      wave: 2,
      trigger: 'order integration is in scope',
      rationale: 'Derived from order integration.',
      dependsOn: ['wp.architecture.resolve-decisions'],
      sourceIds: ['integration.sales-order-request'],
      labels: ['phase:integration', 'scope:mandatory', 'work:integration']
    }
  ]
};

test('hidden issue marker round-trips a stable work-package ID', () => {
  const marker = workPackageIssueMarker('wp.integration.order-api');
  assert.equal(marker, '<!-- eac-work-package:wp.integration.order-api -->');
  assert.equal(workPackageIdFromIssueBody(`hello\n${marker}\nworld`), 'wp.integration.order-api');
  assert.equal(workPackageIdFromIssueBody('no marker'), null);
});

test('dry-run plan preserves work-package IDs, phase/wave labels and dependencies', () => {
  const plan = roadmapToGitHubIssuePlan(ROADMAP, { repository: 'example/implementation' });
  const integration = plan.issues.find((item) => item.workPackageId === 'wp.integration.order-api');

  assert.equal(plan.readyForApply, false);
  assert.equal(plan.approvalRef, null);
  assert.equal(plan.summary.issueCount, 2);
  assert.ok(integration.labels.includes('phase:integration'));
  assert.ok(integration.labels.includes('wave:2'));
  assert.ok(integration.labels.includes('eac:work-package'));
  assert.deepEqual(integration.dependencyWorkPackageIds, ['wp.architecture.resolve-decisions']);
  assert.match(integration.body, /wp\.architecture\.resolve-decisions/);
  assert.match(integration.body, /MISSING — plan cannot be applied yet/);
});

test('approval reference is explicit and makes the reviewed plan eligible for apply', () => {
  const plan = roadmapToGitHubIssuePlan(ROADMAP, {
    repository: 'example/implementation',
    approvalRef: 'architecture-review-2026-09-05'
  });
  assert.equal(plan.readyForApply, true);
  assert.equal(plan.approvalRef, 'architecture-review-2026-09-05');
  assert.ok(plan.issues.every((item) => item.body.includes('architecture-review-2026-09-05')));
});

test('reconciliation treats existing work-package markers as idempotency keys', () => {
  const plan = roadmapToGitHubIssuePlan(ROADMAP, {
    repository: 'example/implementation',
    approvalRef: 'approved'
  });
  const existing = [{
    number: 41,
    html_url: 'https://github.com/example/implementation/issues/41',
    body: `Existing issue\n${workPackageIssueMarker('wp.integration.order-api')}`
  }];
  const reconciliation = reconcileGitHubIssuePlan(plan, existing);

  assert.equal(reconciliation.summary.exists, 1);
  assert.equal(reconciliation.summary.create, 1);
  const orderApi = reconciliation.operations.find((item) => item.workPackageId === 'wp.integration.order-api');
  assert.equal(orderApi.action, 'exists');
  assert.equal(orderApi.existingIssueNumber, 41);
});

test('apply creates only missing issues and is idempotent on the second run', async () => {
  const plan = roadmapToGitHubIssuePlan(ROADMAP, {
    repository: 'example/implementation',
    approvalRef: 'architecture-review-42'
  });
  const issues = [{
    number: 10,
    html_url: 'https://github.com/example/implementation/issues/10',
    body: workPackageIssueMarker('wp.architecture.resolve-decisions')
  }];
  const labels = new Map();
  let nextNumber = 11;
  const adapter = {
    async listIssues() {
      return issues.map((item) => structuredClone(item));
    },
    async ensureLabel(_repository, definition) {
      labels.set(definition.name, definition);
    },
    async createIssue(_repository, issue) {
      const created = {
        number: nextNumber++,
        html_url: `https://github.com/example/implementation/issues/${nextNumber - 1}`,
        ...structuredClone(issue)
      };
      issues.push(created);
      return created;
    }
  };

  const first = await applyGitHubIssuePlan(plan, adapter);
  assert.equal(first.summary.created, 1);
  assert.equal(first.summary.skippedExisting, 1);
  assert.ok(labels.has('phase:integration'));
  assert.equal(issues.length, 2);

  const second = await applyGitHubIssuePlan(plan, adapter);
  assert.equal(second.summary.created, 0);
  assert.equal(second.summary.skippedExisting, 2);
  assert.equal(issues.length, 2);
});

test('apply rejects an unapproved dry-run plan before touching the adapter', async () => {
  const plan = roadmapToGitHubIssuePlan(ROADMAP, { repository: 'example/implementation' });
  let touched = false;
  const adapter = {
    async listIssues() { touched = true; return []; },
    async ensureLabel() { touched = true; },
    async createIssue() { touched = true; }
  };

  await assert.rejects(() => applyGitHubIssuePlan(plan, adapter), /not approved/);
  assert.equal(touched, false);
});
