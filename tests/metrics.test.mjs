import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { composeArchitecture } from '../src/composer.mjs';
import { calculateArchitectureMetrics, METRIC_DEFINITIONS } from '../src/metrics.mjs';

test('architecture metrics are deterministic and definition-backed', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash', 'procure-to-pay', 'record-to-report'],
    constraints: { multiCompany: true, highVolume: true }
  });
  const first = calculateArchitectureMetrics(result);
  const second = calculateArchitectureMetrics(result);
  assert.deepEqual(first, second);

  for (const key of [
    'capabilitiesWithoutSystemSupport',
    'processSystemSpan',
    'integrationsByPattern',
    'integrationsByMode',
    'fanOutProfile',
    'dataObjectsWithoutSystemOfRecord',
    'integrationDependencyDegree',
    'unresolvedDecisionCount',
    'mandatoryWorkPackagesByPhase',
    'conditionalWorkPackageCount',
    'migrationStructure'
  ]) {
    assert.equal(typeof METRIC_DEFINITIONS[key], 'string', key);
    assert.ok(METRIC_DEFINITIONS[key].length > 20, key);
  }
});

test('metrics contain no universal health or weighted architecture score', () => {
  const metrics = calculateArchitectureMetrics(composeArchitecture({ processes: ['order-to-cash'] }));
  const serialized = JSON.stringify(metrics).toLowerCase();
  assert.doesNotMatch(serialized, /"(?:score|healthscore|overallscore|weightedscore)"\s*:/);
  assert.doesNotMatch(serialized, /universal architecture score/);
});

test('Order-to-Cash process system span is transparent', () => {
  const metrics = calculateArchitectureMetrics(composeArchitecture({ processes: ['order-to-cash'] }));
  const o2c = metrics.processSystemSpan.find((item) => item.processId === 'process.order-to-cash');
  assert.equal(o2c.systemRoleCount, 3);
  assert.deepEqual(o2c.systemRoleIds, ['sys.crm', 'sys.erp', 'sys.wms']);
});

test('integration pattern counts reconcile exactly with composed flows', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash', 'procure-to-pay', 'record-to-report'],
    constraints: { highVolume: true }
  });
  const metrics = calculateArchitectureMetrics(result);
  const count = Object.values(metrics.integrationsByPattern).reduce((sum, value) => sum + value, 0);
  assert.equal(count, result.blueprint.integrations.length);
  assert.equal(Object.values(metrics.integrationsByMode).reduce((sum, value) => sum + value, 0), result.blueprint.integrations.length);
});

test('integration dependency degree is a direct count and sorted by connectivity', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash', 'procure-to-pay', 'record-to-report'],
    constraints: { highVolume: true }
  });
  const metrics = calculateArchitectureMetrics(result);
  const degree = metrics.integrationDependencyDegree;
  assert.ok(degree.length > 0);
  for (const item of degree) assert.equal(item.total, item.inbound + item.outbound);
  for (let i = 1; i < degree.length; i += 1) assert.ok(degree[i - 1].total >= degree[i].total);
  assert.match(metrics.definitions.integrationDependencyDegree, /not a failure-risk score/);
});

test('data owner gaps and unresolved decisions remain concrete IDs', () => {
  const result = composeArchitecture({ processes: ['plan-to-produce'] });
  const metrics = calculateArchitectureMetrics(result);
  assert.equal(metrics.dataObjectsWithoutSystemOfRecord.count, metrics.dataObjectsWithoutSystemOfRecord.dataObjectIds.length);
  assert.equal(metrics.unresolvedDecisionCount, metrics.unresolvedDecisionIds.length);
  assert.ok(metrics.unresolvedDecisionIds.includes('quality.process-isolated-system.plan-to-produce'));
});

test('transition metrics expose explicit replacement and coexistence structure', async () => {
  const url = new URL('../examples/scenarios/legacy-wms-replacement.context.json', import.meta.url);
  const context = JSON.parse(await readFile(url, 'utf8'));
  const result = composeArchitecture(context);
  const metrics = calculateArchitectureMetrics(result);

  assert.equal(metrics.migrationStructure.replacementCount, 2);
  assert.equal(metrics.migrationStructure.coexistenceWindowCount, 1);
  assert.ok(metrics.migrationStructure.transitionSystemInstanceCount >= 3);
  assert.ok(metrics.migrationStructure.transitionIntegrationInstanceCount >= 2);
});
