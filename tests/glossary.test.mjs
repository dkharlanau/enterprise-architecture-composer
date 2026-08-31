import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../src/catalog.mjs';
import {
  buildGlossary,
  glossaryEntryById,
  resolveGlossaryAlias,
  validateGlossary
} from '../src/glossary.mjs';
import { composeArchitecture } from '../src/composer.mjs';
import { createInterfaceAsCodeProposal, exportProcessAsCodeStarter } from '../src/handoff.mjs';

test('every public reference catalog object has glossary ID, display name, definition and aliases', () => {
  const glossary = buildGlossary();
  const validation = validateGlossary(glossary);
  assert.equal(validation.valid, true, validation.errors.join('\n'));

  const expectedIds = [
    ...catalog.capabilities,
    ...catalog.systems,
    ...catalog.dataObjects,
    ...catalog.integrationPatterns,
    ...catalog.processes
  ].map((item) => item.id).sort();
  assert.deepEqual(glossary.entries.map((entry) => entry.id), expectedIds);
  assert.ok(glossary.entries.every((entry) => entry.name && entry.definition && entry.aliases.length));
});

test('well-known aliases resolve to canonical stable IDs', () => {
  assert.equal(resolveGlossaryAlias('O2C').id, 'process.order-to-cash');
  assert.equal(resolveGlossaryAlias('customer master').id, 'data.customer');
  assert.equal(resolveGlossaryAlias('change data capture').id, 'pattern.cdc');
  assert.equal(resolveGlossaryAlias('Enterprise Resource Planning').id, 'sys.erp');
});

test('ambiguous alias is never silently merged', () => {
  const result = resolveGlossaryAlias('warehouse');
  assert.equal(result.status, 'ambiguous');
  assert.deepEqual(result.candidates.map((item) => item.id), ['cap.warehouse-management', 'sys.wms']);
  assert.equal(result.id, undefined);
});

test('kind filter resolves an otherwise ambiguous alias explicitly', () => {
  assert.equal(resolveGlossaryAlias('warehouse', { kind: 'system-role' }).id, 'sys.wms');
  assert.equal(resolveGlossaryAlias('warehouse', { kind: 'capability' }).id, 'cap.warehouse-management');
});

test('unknown alias remains unknown rather than fuzzy-matching a neighboring concept', () => {
  const result = resolveGlossaryAlias('warehouse orchestration superapp');
  assert.deepEqual(result, { status: 'unknown', alias: 'warehouse orchestration superapp', candidates: [] });
});

test('glossary lookup retains catalog provenance', () => {
  const entry = glossaryEntryById('data.product');
  assert.equal(entry.id, 'data.product');
  assert.equal(entry.name, 'Product / Material');
  assert.ok(entry.aliases.includes('material'));
  assert.equal(entry.provenance.catalogVersion, catalog.version);
});

test('cross-repository handoff keeps canonical IDs and Composer provenance', () => {
  const result = composeArchitecture({ processes: ['order-to-cash'] });
  const processStarter = exportProcessAsCodeStarter(result, 'order-to-cash');
  const interfaceProposal = createInterfaceAsCodeProposal(result, 'integration.sales-order-request');

  assert.equal(processStarter.process.id, 'process.order-to-cash');
  assert.ok(processStarter.process.tags.includes('capability:cap.order-management'));
  assert.equal(processStarter.extensions.composer.sourceProcessId, 'process.order-to-cash');
  assert.equal(interfaceProposal.provenance.composerIntegrationId, 'integration.sales-order-request');
  assert.ok(interfaceProposal.provenance.source.startsWith('eac://'));
});
