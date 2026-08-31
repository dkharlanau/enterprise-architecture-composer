import test from 'node:test';
import assert from 'node:assert/strict';
import { composeArchitecture } from '../src/composer.mjs';
import {
  adoptInterfaceAsCodeProposal,
  createInterfaceAsCodeProposal,
  exportProcessAsCodeStarter,
  validateInterfaceAsCodeV10,
  validateProcessAsCodeStarter
} from '../src/handoff.mjs';

const result = composeArchitecture({
  processes: ['order-to-cash', 'procure-to-pay'],
  constraints: { highVolume: true, multiCompany: true },
  existingSystems: ['erp']
});

test('Process-as-Code starter is v0.2-shaped and explicitly non-executable', () => {
  const starter = exportProcessAsCodeStarter(result, 'order-to-cash');
  const validation = validateProcessAsCodeStarter(starter);

  assert.equal(validation.valid, true);
  assert.equal(starter.version, '0.2');
  assert.equal(starter.process.id, 'process.order-to-cash');
  assert.ok(starter.process.tags.includes('composer:starter'));
  assert.ok(starter.process.tags.some((tag) => tag.startsWith('capability:')));
  assert.equal(starter.steps[0].type, 'subprocess');
  assert.equal(starter.steps[0].agent.executable, false);
  assert.match(starter.extensions.composer.warning, /does not infer human tasks/);
  assert.ok(starter.artifacts[0].uri.startsWith('eac://'));
});

test('Process-as-Code starter never exports a process outside the composed scope', () => {
  assert.throws(() => exportProcessAsCodeStarter(result, 'plan-to-produce'), /not part of the composed scope/);
});

test('Interface-as-Code proposal exposes required unknowns instead of inventing operational values', () => {
  const proposal = createInterfaceAsCodeProposal(result, 'integration.sales-order-request');
  assert.equal(proposal.readyForAdoption, false);
  assert.equal(proposal.compatibilityTarget.specVersion, '1.0');
  assert.equal(proposal.known.interface.mode, 'sync');
  assert.equal(proposal.known.interface.pattern, 'request-response');
  assert.ok(proposal.unresolved.some((item) => item.field === 'delivery.guarantee'));
  assert.ok(proposal.unresolved.some((item) => item.field === 'monitoring.owner'));
  assert.equal(proposal.known.delivery, undefined);
  assert.equal(proposal.known.monitoring, undefined);
});

test('Interface-as-Code adoption refuses incomplete decisions', () => {
  const proposal = createInterfaceAsCodeProposal(result, 'integration.sales-order-request');
  const adoption = adoptInterfaceAsCodeProposal(proposal, { contractFormat: 'REST' });
  assert.equal(adoption.ready, false);
  assert.equal(adoption.document, null);
  assert.ok(adoption.errors.some((message) => message.includes('deliveryGuarantee')));
  assert.ok(adoption.errors.some((message) => message.includes('monitoringOwner')));
});

test('approved Interface-as-Code handoff produces a v1.0-compatible contract', () => {
  const proposal = createInterfaceAsCodeProposal(result, 'integration.sales-order-request');
  const adoption = adoptInterfaceAsCodeProposal(proposal, {
    contractFormat: 'REST',
    deliveryGuarantee: 'at-least-once',
    idempotencyRequired: true,
    idempotencyKey: 'sales_order_id',
    ordering: 'per-key',
    retryStrategy: 'automatic',
    maxAttempts: 3,
    monitoringOwner: 'Order Integration Operations',
    supportRoute: 'Order Integration Queue',
    monitoringSignals: ['processing_age', 'technical_failure'],
    businessKey: 'sales_order_id',
    reconciliationKey: 'sales_order_id',
    reconciliationFrequency: 'daily',
    sourceOfTruth: 'sys.erp',
    comparison: 'Compare accepted CRM orders with ERP sales orders.'
  });

  assert.equal(adoption.ready, true);
  assert.deepEqual(adoption.errors, []);
  assert.equal(adoption.document.version, '1.0');
  assert.equal(adoption.document.interface.lifecycle, 'proposed');
  assert.equal(adoption.document.contract.format, 'REST');
  assert.equal(adoption.document.delivery.idempotency.key, 'sales_order_id');
  assert.equal(adoption.document.evidence[0].ref.kind, 'custom');
  assert.equal(validateInterfaceAsCodeV10(adoption.document).valid, true);
});

test('partner proposal carries the known external boundary without inventing authentication', () => {
  const proposal = createInterfaceAsCodeProposal(result, 'integration.purchase-order-partner');
  assert.deepEqual(proposal.known.security, { external_exposure: true });
  assert.equal(proposal.known.security.authentication, undefined);
});
