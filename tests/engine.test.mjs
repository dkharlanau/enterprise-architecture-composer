import test from 'node:test';
import assert from 'node:assert/strict';

import {
  composeArchitecture,
  normalizeContext,
  serializeComposition
} from '../src/engine.mjs';

function ids(items) {
  return items.map((item) => item.id);
}

test('order-to-cash composes a coherent minimal cross-system blueprint', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash']
  });

  assert.deepEqual(ids(result.blueprint.processes), ['process.order-to-cash']);
  assert.deepEqual(ids(result.blueprint.systems), ['sys.crm', 'sys.erp', 'sys.integration', 'sys.wms']);
  assert.equal(result.metrics.integrationCount, 3);

  const byId = Object.fromEntries(result.blueprint.integrations.map((item) => [item.id, item]));
  assert.equal(byId['integration.sales-order-request'].patternId, 'pattern.sync-api');
  assert.equal(byId['integration.delivery-to-warehouse'].patternId, 'pattern.async-message');
  assert.equal(byId['integration.warehouse-confirmation'].patternId, 'pattern.domain-event');

  assert.equal(result.metrics.unresolvedDataOwnerCount, 2);
  assert.ok(result.findings.some((item) => item.id === 'finding.owner.customer'));
  assert.ok(result.findings.some((item) => item.id === 'finding.owner.product'));
});

test('multi-company high-volume scope introduces master-data and integration responsibilities', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash', 'procure-to-pay', 'plan-to-produce'],
    constraints: {
      multiCompany: true,
      highVolume: true
    },
    scale: {
      countries: 8,
      legalEntities: 12,
      plants: 4,
      warehouses: 11
    }
  });

  assert.ok(ids(result.blueprint.capabilities).includes('cap.intercompany'));
  assert.ok(ids(result.blueprint.capabilities).includes('cap.master-data'));
  assert.ok(ids(result.blueprint.systems).includes('sys.mdm'));
  assert.ok(ids(result.blueprint.systems).includes('sys.integration'));
  assert.equal(result.metrics.unresolvedDataOwnerCount, 0);

  const partnerFlow = result.blueprint.integrations.find((item) => item.id === 'integration.purchase-order-partner');
  assert.equal(partnerFlow.patternId, 'pattern.edi-b2b');

  const productionEvent = result.blueprint.integrations.find((item) => item.id === 'integration.production-confirmation');
  assert.equal(productionEvent.patternId, 'pattern.domain-event');
  assert.equal(productionEvent.confidence, 'high');

  assert.ok(result.findings.some((item) => item.id === 'finding.multicompany.intercompany-scope'));
  assert.ok(result.workPackages.some((item) => item.id === 'wp.data.master-data'));
  assert.ok(result.workPackages.some((item) => item.id === 'wp.security.partner-boundary'));
});

test('composition is deterministic regardless of input process ordering and duplicates', () => {
  const a = composeArchitecture({
    processes: ['plan-to-produce', 'order-to-cash', 'procure-to-pay'],
    constraints: { highVolume: true, multiCompany: true }
  });

  const b = composeArchitecture({
    processes: ['procure-to-pay', 'order-to-cash', 'plan-to-produce', 'order-to-cash'],
    constraints: { multiCompany: true, highVolume: true }
  });

  assert.equal(serializeComposition(a), serializeComposition(b));
});

test('retained WMS constraint produces an explicit migration decision and work package', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash'],
    existingSystems: ['erp', 'legacy-wms'],
    constraints: { retainLegacyWms: true }
  });

  const wms = result.blueprint.systems.find((item) => item.id === 'sys.wms');
  assert.equal(wms.state, 'current');
  assert.equal(wms.intent, 'keep');
  assert.ok(result.recommendations.some((item) => item.id === 'rec.migration.retain-wms'));
  assert.ok(result.workPackages.some((item) => item.id === 'wp.cutover.wms-coexistence'));
});

test('unknown processes fail explicitly', () => {
  assert.throws(
    () => normalizeContext({ processes: ['order-to-cash', 'invented-process'] }),
    /Unknown process key/
  );
});
