import { createHash } from 'node:crypto';

const MARKER_PREFIX = '<!-- eac-work-package:';
const MARKER_SUFFIX = ' -->';

function sortedUnique(values = []) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(stableObject(value))).digest('hex').slice(0, 16);
}

export function workPackageIssueMarker(workPackageId) {
  if (!String(workPackageId ?? '').startsWith('wp.')) throw new Error(`Invalid work-package ID: ${workPackageId}`);
  return `${MARKER_PREFIX}${workPackageId}${MARKER_SUFFIX}`;
}

export function workPackageIdFromIssueBody(body = '') {
  const escapedPrefix = MARKER_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedSuffix = MARKER_SUFFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(body).match(new RegExp(`${escapedPrefix}(wp\\.[a-zA-Z0-9._-]+)${escapedSuffix}`));
  return match?.[1] ?? null;
}

function labelMetadata(label) {
  if (label === 'eac:work-package') return { name: label, color: '5319e7', description: 'Generated from an Enterprise Architecture Composer work package.' };
  if (label.startsWith('phase:')) return { name: label, color: '1d76db', description: 'Architecture delivery phase.' };
  if (label.startsWith('scope:mandatory')) return { name: label, color: '0e8a16', description: 'Mandatory architecture delivery scope.' };
  if (label.startsWith('scope:conditional')) return { name: label, color: 'fbca04', description: 'Conditional architecture delivery scope.' };
  if (label.startsWith('work:')) return { name: label, color: 'd4c5f9', description: 'Architecture delivery work type.' };
  if (label.startsWith('wave:')) return { name: label, color: 'bfdadc', description: 'Dependency-derived delivery wave.' };
  return { name: label, color: 'ededed', description: 'Enterprise Architecture Composer roadmap label.' };
}

function issueBody(workPackage, planSource) {
  const dependencies = workPackage.dependsOn ?? [];
  const sourceIds = workPackage.sourceIds ?? [];
  const lines = [
    workPackageIssueMarker(workPackage.id),
    '',
    'Generated from an approved Enterprise Architecture Composer delivery roadmap.',
    '',
    '## Work package',
    '',
    `- ID: \`${workPackage.id}\``,
    `- Phase: \`${workPackage.phase}\``,
    `- Scope: \`${workPackage.classification}\``,
    `- Wave: \`${workPackage.wave}\``,
    `- Trigger: ${workPackage.trigger}`,
    `- Rationale: ${workPackage.rationale}`,
    '',
    '## Dependencies',
    '',
    dependencies.length
      ? dependencies.map((id) => `- [ ] \`${id}\``).join('\n')
      : 'No upstream work-package dependency.',
    '',
    '## Source architecture objects',
    '',
    sourceIds.length
      ? sourceIds.map((id) => `- \`${id}\``).join('\n')
      : 'No explicit source object.',
    '',
    '## Provenance',
    '',
    `- Composer engine: \`${planSource.engineVersion}\``,
    `- Catalog: \`${planSource.catalogVersion}\``,
    `- Roadmap schema: \`${planSource.roadmapSchemaVersion}\``,
    `- Plan fingerprint: \`${planSource.planFingerprint}\``,
    `- Approval reference: ${planSource.approvalRef ? `\`${planSource.approvalRef}\`` : '**MISSING — plan cannot be applied yet**'}`,
    '',
    '> Re-running the handoff uses the hidden work-package marker above as the idempotency key. Do not remove it while this issue represents the same work package.',
    ''
  ];
  return lines.join('\n');
}

export function roadmapToGitHubIssuePlan(roadmap, options = {}) {
  if (!roadmap?.packages || !Array.isArray(roadmap.packages)) throw new Error('A delivery roadmap with packages is required.');
  const repository = String(options.repository ?? '').trim();
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) throw new Error('repository must be owner/name.');
  const approvalRef = String(options.approvalRef ?? '').trim() || null;
  const titlePrefix = options.titlePrefix ?? '[EAC]';

  const preliminary = {
    schemaVersion: '0.1',
    repository,
    approvalRef,
    source: {
      engineVersion: roadmap.source?.engineVersion ?? 'unknown',
      catalogVersion: roadmap.source?.catalogVersion ?? 'unknown',
      roadmapSchemaVersion: roadmap.schemaVersion ?? 'unknown'
    },
    packages: roadmap.packages.map((item) => ({
      id: item.id,
      phase: item.phase,
      classification: item.classification,
      wave: item.wave,
      title: item.title,
      trigger: item.trigger,
      rationale: item.rationale,
      dependsOn: sortedUnique(item.dependsOn),
      sourceIds: sortedUnique(item.sourceIds),
      labels: sortedUnique(['eac:work-package', ...(item.labels ?? []), `wave:${item.wave}`])
    }))
  };
  const planFingerprint = fingerprint(preliminary);
  const source = { ...preliminary.source, approvalRef, planFingerprint };
  const issues = preliminary.packages.map((item) => ({
    workPackageId: item.id,
    idempotencyMarker: workPackageIssueMarker(item.id),
    title: `${titlePrefix} ${item.title}`,
    body: issueBody(item, source),
    labels: item.labels,
    labelDefinitions: item.labels.map(labelMetadata),
    dependencyWorkPackageIds: item.dependsOn,
    phase: item.phase,
    wave: item.wave
  }));

  return {
    format: 'enterprise-architecture-composer/github-issue-plan',
    formatVersion: '0.1',
    repository,
    readyForApply: Boolean(approvalRef),
    approvalRef,
    planFingerprint,
    source: preliminary.source,
    issues,
    summary: {
      issueCount: issues.length,
      labelCount: sortedUnique(issues.flatMap((item) => item.labels)).length,
      dependencyEdgeCount: issues.reduce((sum, item) => sum + item.dependencyWorkPackageIds.length, 0)
    }
  };
}

export function reconcileGitHubIssuePlan(plan, existingIssues = []) {
  if (plan?.format !== 'enterprise-architecture-composer/github-issue-plan') throw new Error('Not an Enterprise Architecture Composer GitHub issue plan.');
  const byWorkPackageId = new Map();
  for (const issue of existingIssues) {
    const id = workPackageIdFromIssueBody(issue.body ?? '');
    if (!id) continue;
    if (!byWorkPackageId.has(id)) byWorkPackageId.set(id, issue);
  }

  const operations = plan.issues.map((planned) => {
    const existing = byWorkPackageId.get(planned.workPackageId);
    return existing
      ? {
          action: 'exists',
          workPackageId: planned.workPackageId,
          existingIssueNumber: existing.number,
          existingIssueUrl: existing.html_url ?? existing.url ?? null,
          planned
        }
      : {
          action: 'create',
          workPackageId: planned.workPackageId,
          existingIssueNumber: null,
          existingIssueUrl: null,
          planned
        };
  });

  return {
    planFingerprint: plan.planFingerprint,
    repository: plan.repository,
    operations,
    summary: {
      create: operations.filter((item) => item.action === 'create').length,
      exists: operations.filter((item) => item.action === 'exists').length,
      total: operations.length
    }
  };
}

export async function applyGitHubIssuePlan(plan, adapter, options = {}) {
  if (!plan?.readyForApply || !plan?.approvalRef) {
    throw new Error('GitHub issue plan is not approved. Regenerate it with a non-empty approvalRef before apply.');
  }
  if (!adapter?.listIssues || !adapter?.createIssue || !adapter?.ensureLabel) {
    throw new Error('GitHub adapter must provide listIssues, createIssue and ensureLabel.');
  }
  const existingIssues = await adapter.listIssues(plan.repository);
  const reconciliation = reconcileGitHubIssuePlan(plan, existingIssues);
  const created = [];
  const skipped = [];

  const definitions = new Map(plan.issues.flatMap((issue) => issue.labelDefinitions.map((label) => [label.name, label])));
  for (const definition of [...definitions.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    await adapter.ensureLabel(plan.repository, definition);
  }

  for (const operation of reconciliation.operations) {
    if (operation.action === 'exists') {
      skipped.push(operation);
      continue;
    }
    const issue = await adapter.createIssue(plan.repository, {
      title: operation.planned.title,
      body: operation.planned.body,
      labels: operation.planned.labels
    });
    created.push({
      workPackageId: operation.workPackageId,
      issueNumber: issue.number,
      issueUrl: issue.html_url ?? issue.url ?? null
    });
  }

  return {
    repository: plan.repository,
    approvalRef: plan.approvalRef,
    planFingerprint: plan.planFingerprint,
    created,
    skipped,
    summary: {
      created: created.length,
      skippedExisting: skipped.length,
      total: reconciliation.operations.length
    },
    dryRun: Boolean(options.dryRun)
  };
}

export function createGitHubRestAdapter(token, options = {}) {
  if (!token) throw new Error('A GitHub token is required for apply.');
  const apiBase = options.apiBase ?? 'https://api.github.com';
  const requester = options.fetch ?? globalThis.fetch;
  if (typeof requester !== 'function') throw new Error('fetch implementation is required.');

  async function request(path, init = {}) {
    const response = await requester(`${apiBase}${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...(init.headers ?? {})
      }
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitHub API ${response.status} ${path}: ${body}`);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  return {
    async listIssues(repository) {
      const items = [];
      for (let page = 1; page <= 100; page += 1) {
        const batch = await request(`/repos/${repository}/issues?state=all&per_page=100&page=${page}`);
        items.push(...batch.filter((item) => !item.pull_request));
        if (batch.length < 100) break;
      }
      return items;
    },
    async ensureLabel(repository, definition) {
      const encoded = encodeURIComponent(definition.name);
      try {
        await request(`/repos/${repository}/labels/${encoded}`);
      } catch (error) {
        if (!String(error.message).includes('GitHub API 404')) throw error;
        await request(`/repos/${repository}/labels`, {
          method: 'POST',
          body: JSON.stringify(definition)
        });
      }
    },
    async createIssue(repository, issue) {
      return request(`/repos/${repository}/issues`, {
        method: 'POST',
        body: JSON.stringify(issue)
      });
    }
  };
}
