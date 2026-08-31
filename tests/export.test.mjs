import test from 'node:test';
import assert from 'node:assert/strict';
import { composeArchitecture } from '../src/composer.mjs';
import {
  bundleToMarkdown,
  createPortableBundle,
  createShareableContext,
  restoreContextFromBundle,
  serializeBundle,
  verifyBundleRecomposition
} from '../src/export.mjs';

test('portable bundle recomposes to the identical public Composer blueprint', () => {
  const result = composeArchitecture({
    industry: 'manufacturing',
    operatingModel: 'b2b',
    processes: ['order-to-cash', 'procure-to-pay', 'record-to-report'],
    constraints: { multiCompany: true, highVolume: true },
    existingSystems: ['erp']
  });
  const bundle = createPortableBundle(result);
  const verification = verifyBundleRecomposition(bundle);
  const restored = restoreContextFromBundle(bundle);

  assert.equal(result.engineVersion, '0.2.0');
  assert.equal(verification.matches, true);
  assert.deepEqual(restored.existingSystems, bundle.context.existingSystemIds);
  assert.deepEqual(restored.processes, bundle.context.processes);
  assert.deepEqual(restored.constraints, bundle.context.constraints);
});

test('portable bundle preserves explicit NFR profiles and strict policy across roundtrip', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash'],
    requireExplicitNfrs: true,
    nfrProfile: { volume: 'high', replay: 'desirable' },
    integrationProfiles: {
      'integration.delivery-to-warehouse': {
        latency: 'hours',
        consistency: 'snapshot',
        payloadSize: 'very-large',
        offlineTolerance: 'extended'
      }
    }
  });
  const bundle = createPortableBundle(result);
  const restored = restoreContextFromBundle(bundle);
  const verification = verifyBundleRecomposition(bundle);

  assert.equal(restored.requireExplicitNfrs, true);
  assert.deepEqual(restored.nfrProfile, result.context.nfrProfile);
  assert.deepEqual(restored.integrationProfiles, result.context.integrationProfiles);
  assert.equal(verification.matches, true);
});

test('shareable context strips unknown company-specific fields', () => {
  const clean = createShareableContext({
    industry: 'manufacturing',
    operatingModel: 'b2b',
    processes: ['order-to-cash'],
    scale: { countries: 1, legalEntities: 1, plants: 1, warehouses: 1 },
    constraints: { multiCompany: false, highVolume: false, retainLegacyWms: false },
    existingSystemIds: ['sys.erp'],
    requireExplicitNfrs: true,
    companyName: 'Sensitive Customer Name',
    notes: 'confidential'
  });

  assert.equal(clean.companyName, undefined);
  assert.equal(clean.notes, undefined);
  assert.equal(clean.requireExplicitNfrs, true);
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
    constraints: { multiCompany: true },
    requireExplicitNfrs: true,
    nfrProfile: { volume: 'high' }
  });
  const report = bundleToMarkdown(createPortableBundle(result));

  assert.match(report, /^# Enterprise Architecture Decision Report/m);
  assert.match(report, /## Context/);
  assert.match(report, /Explicit NFR confirmation: required/);
  assert.match(report, /explicit NFR gaps/);
  assert.match(report, /## Target architecture/);
  assert.match(report, /## Architecture findings/);
  assert.match(report, /## Recommendations/);
  assert.match(report, /## Delivery roadmap/);
  assert.match(report, /Next decision:/);
});
