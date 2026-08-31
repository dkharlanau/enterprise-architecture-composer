import test from 'node:test';
import assert from 'node:assert/strict';
import { composeArchitecture } from '../src/engine.mjs';
import {
  bundleToMarkdown,
  createPortableBundle,
  createShareableContext,
  restoreContextFromBundle,
  serializeBundle,
  verifyBundleRecomposition
} from '../src/export.mjs';

test('portable bundle recomposes to the identical blueprint', () => {
  const result = composeArchitecture({
    industry: 'manufacturing',
    operatingModel: 'b2b',
    processes: ['order-to-cash', 'procure-to-pay', 'record-to-report'],
    constraints: { multiCompany: true, highVolume: true },
    existingSystems: ['erp']
  });
  const bundle = createPortableBundle(result);
  const verification = verifyBundleRecomposition(bundle);

  assert.equal(verification.matches, true);
  assert.deepEqual(restoreContextFromBundle(bundle), bundle.context);
});

test('shareable context strips unknown company-specific fields', () => {
  const clean = createShareableContext({
    industry: 'manufacturing',
    operatingModel: 'b2b',
    processes: ['order-to-cash'],
    scale: { countries: 1, legalEntities: 1, plants: 1, warehouses: 1 },
    constraints: { multiCompany: false, highVolume: false, retainLegacyWms: false },
    existingSystemIds: ['sys.erp'],
    companyName: 'Sensitive Customer Name',
    notes: 'confidential'
  });

  assert.equal(clean.companyName, undefined);
  assert.equal(clean.notes, undefined);
  assert.deepEqual(clean.existingSystemIds, ['sys.erp']);
});

test('bundle serialization is deterministic and Git-review friendly', () => {
  const result = composeArchitecture({ processes: ['order-to-cash'] });
  const one = serializeBundle(createPortableBundle(result));
  const two = serializeBundle(createPortableBundle(result));
  assert.equal(one, two);
  assert.match(one, /"format": "enterprise-architecture-composer\/bundle"/);
});

test('Markdown report contains context, decisions, findings and roadmap', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash', 'procure-to-pay'],
    constraints: { multiCompany: true }
  });
  const report = bundleToMarkdown(createPortableBundle(result));

  assert.match(report, /^# Enterprise Architecture Decision Report/m);
  assert.match(report, /## Context/);
  assert.match(report, /## Target architecture/);
  assert.match(report, /## Architecture findings/);
  assert.match(report, /## Recommendations/);
  assert.match(report, /## Delivery roadmap/);
  assert.match(report, /Next decision:/);
});
