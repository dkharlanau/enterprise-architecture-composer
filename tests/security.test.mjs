import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { composeArchitecture } from '../src/composer.mjs';
import { createPortableBundle, verifyBundleRecomposition } from '../src/export.mjs';
import { toVisualWorkbench } from '../src/visual-projection.mjs';
import { ruleById } from '../src/rulebook.mjs';

async function loadSecurityScenario() {
  return JSON.parse(await readFile(new URL('../examples/scenarios/security-boundaries.context.json', import.meta.url), 'utf8'));
}

test('partner boundary is a first-class trust boundary without claiming compliance', () => {
  const result = composeArchitecture({ processes: ['procure-to-pay'] });
  const boundary = result.blueprint.trustBoundaries.find((item) => item.id === 'trust.external-partner');

  assert.ok(boundary);
  assert.ok(boundary.integrationIds.includes('integration.purchase-order-partner'));
  assert.equal(result.security.review.complianceStatus, 'not-assessed');
  assert.match(result.security.review.statement, /does not assert.*compliance/i);
  assert.ok(result.workPackages.some((item) => item.id === 'wp.security.partner-boundary'));
});

test('explicit public identity boundary generates security decisions and delivery dependencies', async () => {
  const result = composeArchitecture(await loadSecurityScenario());
  const integrationWork = result.workPackages.find((item) => item.id === 'wp.integration.sales-order-request');

  assert.ok(result.blueprint.trustBoundaries.some((item) => item.id === 'trust.public-api'));
  assert.ok(result.blueprint.trustBoundaries.some((item) => item.id === 'trust.identity'));
  assert.ok(result.findings.some((item) => item.ruleIds.includes('SEC-PUBLIC-001')));
  assert.ok(result.findings.some((item) => item.ruleIds.includes('SEC-IDENTITY-001')));
  assert.ok(integrationWork.dependsOn.includes('wp.security.public-api'));
  assert.ok(integrationWork.dependsOn.includes('wp.security.identity-boundaries'));
});

test('private privileged integration creates explicit boundary controls', async () => {
  const result = composeArchitecture(await loadSecurityScenario());
  const integrationWork = result.workPackages.find((item) => item.id === 'wp.integration.delivery-to-warehouse');

  assert.ok(result.blueprint.trustBoundaries.some((item) => item.id === 'trust.private-api'));
  assert.ok(result.blueprint.trustBoundaries.some((item) => item.id === 'trust.privileged-integration'));
  assert.ok(result.findings.some((item) => item.ruleIds.includes('SEC-PRIVILEGED-001')));
  assert.ok(integrationWork.dependsOn.includes('wp.security.private-api'));
  assert.ok(integrationWork.dependsOn.includes('wp.security.privileged-integrations'));
});

test('sensitive data, residency and audit evidence remain separate explicit concerns', async () => {
  const result = composeArchitecture(await loadSecurityScenario());

  assert.ok(result.blueprint.trustBoundaries.some((item) => item.id === 'trust.data.customer'));
  assert.ok(result.blueprint.trustBoundaries.some((item) => item.id === 'trust.residency.customer'));
  assert.ok(result.findings.some((item) => item.ruleIds.includes('SEC-SENSITIVE-001')));
  assert.ok(result.findings.some((item) => item.ruleIds.includes('SEC-RESIDENCY-001')));
  assert.ok(result.findings.some((item) => item.ruleIds.includes('SEC-AUDIT-001')));
  assert.ok(result.workPackages.some((item) => item.id === 'wp.security.sensitive-data'));
  assert.ok(result.workPackages.some((item) => item.id === 'wp.security.data-residency'));
  assert.ok(result.workPackages.some((item) => item.id === 'wp.security.audit-evidence'));
  assert.equal(result.metrics.sensitiveDataObjectCount, 1);
  assert.equal(result.metrics.residencyConstraintCount, 1);
});

test('every emitted security rule is registered as fixture-backed guidance', async () => {
  const result = composeArchitecture(await loadSecurityScenario());
  const ruleIds = new Set([
    ...result.blueprint.trustBoundaries.flatMap((item) => item.ruleIds),
    ...result.findings.filter((item) => item.kind === 'security-decision').flatMap((item) => item.ruleIds)
  ]);

  for (const id of ruleIds) {
    const rule = ruleById(id);
    assert.ok(rule, `missing security rule ${id}`);
    assert.equal(rule.implemented, true, id);
    assert.equal(rule.maturity, 'fixture-backed', id);
  }
});

test('security profile survives portable bundle recomposition', async () => {
  const result = composeArchitecture(await loadSecurityScenario());
  const bundle = createPortableBundle(result);
  const verification = verifyBundleRecomposition(bundle);

  assert.deepEqual(bundle.context.securityProfile, result.context.securityProfile);
  assert.equal(verification.matches, true);
});

test('Visual Workbench projection includes trust-boundary nodes and security view', async () => {
  const projection = toVisualWorkbench(composeArchitecture(await loadSecurityScenario())).visual;

  assert.ok(projection.nodes.some((item) => item.id === 'trust.public-api' && item.group === 'security'));
  assert.ok(projection.nodes.some((item) => item.id === 'trust.data.customer' && item.tags.includes('trust-boundary')));
  assert.ok(projection.edges.some((item) => item.to === 'trust.public-api' && item.label === 'crosses trust boundary'));
  assert.ok(projection.views.some((item) => item.id === 'security'));
});
