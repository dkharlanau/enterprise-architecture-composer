import test from 'node:test';
import assert from 'node:assert/strict';

import { composeArchitecture, serializeComposition } from '../src/engine.mjs';
import { diffCompositions } from '../src/diff.mjs';

const BASE = {
  processes: ['order-to-cash'],
  existingSystems: ['erp', 'legacy-wms'],
  constraints: { retainLegacyWms: true }
};

const TARGET = {
  processes: ['order-to-cash', 'procure-to-pay', 'plan-to-produce'],
  existingSystems: ['erp', 'legacy-wms'],
  constraints: { retainLegacyWms: true, highVolume: true, multiCompany: true }
};

test('scenario delta lists added architecture and delivery objects', () => {
  const base = composeArchitecture(BASE);
  const target = composeArchitecture(TARGET);
  const delta = diffCompositions(base, target);

  assert.ok(delta.summary.added > 0);
  assert.ok(delta.changes.some((item) => item.id === 'sys.mdm' && item.change === 'added'));
  assert.ok(delta.changes.some((item) => item.id === 'sys.mes' && item.change === 'added'));
  assert.ok(delta.changes.some((item) => item.id === 'integration.purchase-order-partner' && item.change === 'added'));
  assert.ok(delta.changes.some((item) => item.id === 'data.supplier' && item.change === 'added'));
  assert.ok(delta.changes.some((item) => item.id === 'wp.data.master-data' && item.change === 'added'));
});

test('changed objects preserve an explainable reason trace', () => {
  const base = composeArchitecture({
    processes: ['order-to-cash'],
    existingSystems: ['erp']
  });
  const target = composeArchitecture({
    processes: ['order-to-cash'],
    existingSystems: ['erp', 'crm']
  });
  const delta = diffCompositions(base, target);

  const crm = delta.changes.find((item) => item.id === 'sys.crm');
  assert.equal(crm.change, 'changed');
  assert.equal(crm.before.state, 'target');
  assert.equal(crm.after.state, 'current');
  assert.ok(crm.because.includes('process.order-to-cash'));
});

test('scenario comparison never mutates either composition', () => {
  const base = composeArchitecture(BASE);
  const target = composeArchitecture(TARGET);
  const beforeBase = serializeComposition(base);
  const beforeTarget = serializeComposition(target);

  diffCompositions(base, target);

  assert.equal(serializeComposition(base), beforeBase);
  assert.equal(serializeComposition(target), beforeTarget);
});

test('delta emits compact impact seeds for downstream change analysis', () => {
  const delta = diffCompositions(composeArchitecture(BASE), composeArchitecture(TARGET));
  assert.equal(delta.impactSeeds.length, delta.summary.total);
  assert.ok(delta.impactSeeds.every((seed) => seed.id && seed.kind && seed.change));
});
