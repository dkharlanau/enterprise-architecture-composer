import test from 'node:test';
import assert from 'node:assert/strict';
import { composeArchitecture, serializeComposition } from '../src/composer.mjs';
import {
  PROVENANCE_SOURCES,
  provenanceForCatalogObject,
  provenanceForRecommendation,
  provenanceForRule,
  resultProvenance,
  stalenessReport
} from '../src/provenance.mjs';

test('integration rule provenance is resolved and explicitly heuristic', () => {
  const provenance = provenanceForRule('INT-SYNC-001');
  assert.equal(provenance.status, 'resolved');
  assert.equal(provenance.family, 'integration');
  assert.ok(provenance.sources.some((source) => source.id === 'source.integration.pattern-method'));
  assert.ok(provenance.sources.every((source) => ['heuristic', 'internal-methodology'].includes(source.evidenceType)));
  assert.equal(provenance.sources.some((source) => source.evidenceType === 'heuristic'), true);
});

test('catalog object provenance is linked to manufacturing reference knowledge', () => {
  const provenance = provenanceForCatalogObject('sys.erp');
  assert.equal(provenance.status, 'resolved');
  assert.equal(provenance.kind, 'system-role');
  assert.ok(provenance.sources.some((source) => source.id === 'source.catalog.manufacturing-reference'));
  assert.ok(provenance.sources.some((source) => source.evidenceType === 'heuristic'));
});

test('recommendation provenance combines rule and catalog/object evidence', () => {
  const result = composeArchitecture({ processes: ['order-to-cash'] });
  const recommendation = result.recommendations.find((item) => item.id === 'rec.integration.sales-order-request');
  const provenance = provenanceForRecommendation(recommendation);

  assert.ok(provenance.rules.some((item) => item.ruleId === 'INT-SYNC-001'));
  assert.ok(provenance.objects.some((item) => item.objectId === 'integration.sales-order-request') === false);
  assert.ok(provenance.objects.some((item) => item.objectId === 'pattern.sync-api'));
  assert.ok(provenance.sources.some((source) => source.id === 'source.integration.pattern-method'));
});

test('whole-result provenance resolves all registered emitted rules and catalog objects it recognizes', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash', 'procure-to-pay', 'record-to-report'],
    constraints: { multiCompany: true, highVolume: true }
  });
  const provenance = resultProvenance(result);

  assert.ok(provenance.rules.length > 0);
  assert.ok(provenance.objects.length > 0);
  assert.ok(provenance.sources.length > 0);
  assert.ok(provenance.rules.every((item) => item.status === 'resolved'));
  assert.ok(provenance.objects.every((item) => item.status === 'resolved'));
});

test('staleness is evaluated only against an explicit as-of date', () => {
  const current = stalenessReport('2026-08-31');
  const stale = stalenessReport('2027-03-01');

  assert.ok(current.sources.every((item) => item.status === 'current'));
  assert.ok(stale.sources.some((item) => item.status === 'stale'));
  assert.throws(() => stalenessReport(), /explicit asOf date/);
  assert.throws(() => stalenessReport('31-08-2026'), /YYYY-MM-DD/);
});

test('asking for provenance or staleness never changes deterministic composition output', () => {
  const result = composeArchitecture({ processes: ['order-to-cash'], constraints: { highVolume: true } });
  const before = serializeComposition(result);
  resultProvenance(result, { asOf: '2026-08-31' });
  resultProvenance(result, { asOf: '2027-03-01' });
  assert.equal(serializeComposition(result), before);
});

test('registry source classification never claims a standard or vendor fact without such evidence', () => {
  assert.ok(PROVENANCE_SOURCES.length >= 8);
  assert.ok(PROVENANCE_SOURCES.every((source) => ['heuristic', 'internal-methodology'].includes(source.evidenceType)));
  assert.equal(PROVENANCE_SOURCES.some((source) => ['standard', 'vendor-docs'].includes(source.evidenceType)), false);
});
