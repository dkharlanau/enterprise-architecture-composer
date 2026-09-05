import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { composeArchitecture } from '../src/composer.mjs';
import {
  architecturePackOverlay,
  composeArchitectureWithPacks,
  validateArchitecturePack,
  validateArchitecturePackSet
} from '../src/packs.mjs';

async function loadPack(name) {
  return JSON.parse(await readFile(new URL(`../packs/${name}`, import.meta.url), 'utf8'));
}

function clone(value) {
  return structuredClone(value);
}

function alternateErpVendorPack() {
  return {
    format: 'enterprise-architecture-composer/architecture-pack',
    formatVersion: '0.1',
    pack: {
      id: 'pack.vendor.example-erp',
      version: '0.1.0',
      kind: 'vendor',
      name: 'Example ERP option',
      description: 'A second vendor option used to prove that architecture packs coexist instead of replacing one another.'
    },
    evidence: [{
      id: 'pack.vendor.example-erp.evidence.mapping',
      evidenceType: 'internal-methodology',
      title: 'Example ERP mapping evidence',
      note: 'Fixture-only mapping evidence used to test deterministic multi-vendor coexistence.'
    }],
    aliases: [],
    guidance: [],
    options: [{
      id: 'pack.vendor.example-erp.option.erp',
      optionType: 'system-role',
      targetId: 'sys.erp',
      name: 'Example ERP',
      vendor: 'Example Vendor',
      description: 'A second candidate implementation for the stable ERP responsibility.',
      fitEvidence: [{
        statement: 'Mapped to the ERP responsibility for coexistence testing; project fit remains explicitly unassessed.',
        sourceIds: ['pack.vendor.example-erp.evidence.mapping']
      }],
      commercialPreference: { status: 'none' }
    }]
  };
}

test('published automotive and SAP packs validate cleanly', async () => {
  const automotive = await loadPack('industry-automotive.pack.json');
  const sap = await loadPack('vendor-sap.pack.json');

  assert.equal(validateArchitecturePack(automotive).valid, true);
  assert.equal(validateArchitecturePack(sap).valid, true);
  assert.equal(validateArchitecturePackSet([automotive, sap]).valid, true);
});

test('runtime validation rejects fields not allowed by the published pack schema', async () => {
  const pack = await loadPack('industry-automotive.pack.json');
  pack.pack.unreviewedMagic = true;
  pack.guidance[0].weight = 0.9;
  const validation = validateArchitecturePack(pack);

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((item) => item.includes("pack contains unsupported field 'unreviewedMagic'")));
  assert.ok(validation.errors.some((item) => item.includes("contains unsupported field 'weight'")));
});

test('pack cannot define or replace core rules', async () => {
  const pack = await loadPack('industry-automotive.pack.json');
  pack.rules = [{ id: 'INT-SYNC-001', replacement: true }];
  const validation = validateArchitecturePack(pack);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((item) => item.includes('cannot define or replace core rules')));
});

test('broken core references are rejected', async () => {
  const pack = await loadPack('vendor-sap.pack.json');
  pack.options[0].targetId = 'sys.does-not-exist';
  const validation = validateArchitecturePack(pack);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((item) => item.includes('unknown core target sys.does-not-exist')));
});

test('pack cannot reuse a core-ambiguous alias', async () => {
  const pack = await loadPack('vendor-sap.pack.json');
  pack.aliases.push({
    id: 'pack.vendor.sap.alias.warehouse',
    alias: 'warehouse',
    targetId: 'sys.wms'
  });
  const validation = validateArchitecturePack(pack);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((item) => item.includes("Alias 'warehouse' is already ambiguous")));
});

test('duplicate semantic IDs are rejected within and across packs', async () => {
  const sap = await loadPack('vendor-sap.pack.json');
  const duplicateWithin = clone(sap);
  duplicateWithin.options[1].id = duplicateWithin.options[0].id;
  assert.ok(validateArchitecturePack(duplicateWithin).errors.some((item) => item.includes('Duplicate pack record ID')));

  const duplicatePack = clone(sap);
  const setValidation = validateArchitecturePackSet([sap, duplicatePack]);
  assert.equal(setValidation.valid, false);
  assert.ok(setValidation.errors.some((item) => item.includes('Duplicate pack ID')));
});

test('fact classification requires standard or vendor-docs evidence', async () => {
  const pack = await loadPack('industry-automotive.pack.json');
  pack.guidance[0].classification = 'fact';
  const validation = validateArchitecturePack(pack);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((item) => item.includes('classified as fact')));
});

test('vendor option must keep fit evidence separate from commercial preference', async () => {
  const pack = await loadPack('vendor-sap.pack.json');
  delete pack.options[0].commercialPreference;
  const validation = validateArchitecturePack(pack);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((item) => item.includes('commercialPreference.status separate from fitEvidence')));
});

test('core composition works identically with no packs', () => {
  const context = {
    processes: ['order-to-cash', 'procure-to-pay'],
    constraints: { highVolume: true, multiCompany: true }
  };
  const core = composeArchitecture(context);
  const withPackSurface = composeArchitectureWithPacks(context, []);

  assert.deepEqual(withPackSurface.composition, core);
  assert.deepEqual(withPackSurface.packOverlay.packs, []);
  assert.deepEqual(withPackSurface.packOverlay.guidance, []);
  assert.deepEqual(withPackSurface.packOverlay.options, []);
});

test('industry and vendor packs coexist without mutating core blueprint or rule trace', async () => {
  const automotive = await loadPack('industry-automotive.pack.json');
  const sap = await loadPack('vendor-sap.pack.json');
  const context = {
    processes: ['order-to-cash', 'procure-to-pay', 'plan-to-produce'],
    constraints: { highVolume: true, multiCompany: true }
  };
  const core = composeArchitecture(context);
  const before = JSON.stringify(core);
  const overlay = architecturePackOverlay(core, [sap, automotive]);

  assert.equal(JSON.stringify(core), before);
  assert.deepEqual(overlay.packs.map((item) => item.id), ['pack.industry.automotive', 'pack.vendor.sap']);
  assert.ok(overlay.guidance.some((item) => item.packId === 'pack.industry.automotive'));
  assert.ok(overlay.options.some((item) => item.id === 'pack.vendor.sap.option.s4hana'));
  assert.ok(overlay.options.some((item) => item.id === 'pack.vendor.sap.option.integration-suite'));
});

test('multiple vendor packs targeting the same core role coexist as alternatives', async () => {
  const sap = await loadPack('vendor-sap.pack.json');
  const otherVendor = alternateErpVendorPack();
  const result = composeArchitecture({ processes: ['order-to-cash'] });
  const overlay = architecturePackOverlay(result, [sap, otherVendor]);
  const erpOptions = overlay.options.filter((item) => item.targetId === 'sys.erp');

  assert.equal(validateArchitecturePackSet([sap, otherVendor]).valid, true);
  assert.deepEqual(erpOptions.map((item) => item.id), [
    'pack.vendor.example-erp.option.erp',
    'pack.vendor.sap.option.s4hana'
  ]);
  assert.ok(erpOptions.every((item) => item.commercialPreference.status === 'none'));
});

test('vendor options expose technical fit evidence and commercial preference as separate review fields', async () => {
  const sap = await loadPack('vendor-sap.pack.json');
  const result = composeArchitecture({ processes: ['order-to-cash'] });
  const overlay = architecturePackOverlay(result, [sap]);
  const option = overlay.options.find((item) => item.id === 'pack.vendor.sap.option.s4hana');

  assert.ok(option.fitEvidence.length > 0);
  assert.equal(option.commercialPreference.status, 'none');
  assert.ok(option.evidence.every((item) => item.evidenceType === 'internal-methodology'));
  assert.equal(Object.hasOwn(option, 'score'), false);
});
