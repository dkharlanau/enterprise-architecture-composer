import test from 'node:test';
import assert from 'node:assert/strict';
import { composeArchitecture } from '../src/composer.mjs';
import { analyzeArchitectureQuality } from '../src/quality.mjs';

test('Order-to-Cash has connected reference system handoffs', () => {
  const result = composeArchitecture({ processes: ['order-to-cash'] });
  assert.equal(result.metrics.processIntegrationGapCount, 0);
  assert.equal(result.findings.some((item) => item.id === 'quality.process-isolated-system.order-to-cash'), false);
});

test('Plan-to-Produce exposes the currently missing WMS handoff as an architecture gap', () => {
  const result = composeArchitecture({ processes: ['plan-to-produce'] });
  const finding = result.findings.find((item) => item.id === 'quality.process-isolated-system.plan-to-produce');

  assert.ok(finding);
  assert.equal(finding.severity, 'warning');
  assert.ok(finding.objectIds.includes('sys.wms'));
  assert.match(finding.nextDecision, /missing handoff/);
  assert.equal(result.metrics.processIntegrationGapCount, 1);
});

test('quality warning is pulled into the architecture decision work package', () => {
  const result = composeArchitecture({ processes: ['plan-to-produce'] });
  const workPackage = result.workPackages.find((item) => item.id === 'wp.architecture.resolve-decisions');
  assert.ok(workPackage.sourceIds.includes('quality.process-isolated-system.plan-to-produce'));
});

test('unsupported capability is detected when a required supporting role is absent', () => {
  const result = composeArchitecture({ processes: ['order-to-cash'] });
  const mutated = structuredClone(result);
  mutated.blueprint.systems = mutated.blueprint.systems.filter((item) => item.id !== 'sys.wms');
  const quality = analyzeArchitectureQuality(mutated);

  assert.ok(quality.findings.some((item) => item.id === 'quality.capability-support.warehouse-management'));
  assert.equal(quality.metrics.unsupportedCapabilityCount, 1);
});

test('unjustified system role is detected deterministically', () => {
  const result = composeArchitecture({ processes: ['order-to-cash'] });
  const mutated = structuredClone(result);
  mutated.blueprint.systems.push({
    id: 'sys.tms',
    kind: 'system-role',
    name: 'TMS',
    description: 'Synthetic unjustified role for diagnostic test.',
    state: 'target',
    intent: 'introduce',
    reasonIds: []
  });
  mutated.blueprint.systems.sort((a, b) => a.id.localeCompare(b.id));

  const first = analyzeArchitectureQuality(mutated);
  const second = analyzeArchitectureQuality(mutated);
  assert.deepEqual(first, second);
  assert.ok(first.findings.some((item) => item.id === 'quality.system-justification.tms'));
  assert.equal(first.metrics.unjustifiedSystemCount, 1);
});
