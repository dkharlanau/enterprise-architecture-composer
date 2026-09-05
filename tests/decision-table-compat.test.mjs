import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  compareNativeIntegrationDecisions,
  decisionTableCompatibilitySummary,
  validateDecisionTableCompatibilityShape
} from '../src/decision-table-compat.mjs';

async function loadJson(path) {
  return JSON.parse(await readFile(new URL(`../compatibility/decision-tables/${path}`, import.meta.url), 'utf8'));
}

test('integration-pattern prototype follows Decision Tables as Code v1 structural contract', async () => {
  const table = await loadJson('integration-pattern-v1.json');
  const validation = validateDecisionTableCompatibilityShape(table);

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
  assert.equal(table.version, 1);
  assert.equal(table.hit_policy, 'first');
  assert.equal(validation.compatibilityTarget.product, 'decision-tables-as-code');
  assert.equal(Object.hasOwn(table, '$schema'), false);
});

test('prototype rule sources remain registered Composer rule IDs', async () => {
  const table = await loadJson('integration-pattern-v1.json');
  const validation = validateDecisionTableCompatibilityShape(table);
  assert.equal(validation.valid, true);
  assert.ok(table.rules.every((rule) => /^[A-Z0-9-]+-\d{3}$/.test(rule.source)));
});

test('golden vectors match native Composer integration decisions deterministically', async () => {
  const table = await loadJson('integration-pattern-v1.json');
  const vectors = await loadJson('integration-pattern-v1.vectors.json');
  const first = compareNativeIntegrationDecisions(table, vectors);
  const second = compareNativeIntegrationDecisions(table, vectors);

  assert.deepEqual(first, second);
  assert.equal(first.shapeValid, true);
  assert.equal(first.deterministicNativeEquivalence, true);
  assert.equal(first.mismatches.length, 0);
  assert.equal(first.vectors.length, 9);
  assert.ok(first.vectors.every((item) => item.matches));
});

test('compatibility report explicitly states that Composer has no decision-table evaluator', async () => {
  const table = await loadJson('integration-pattern-v1.json');
  const vectors = await loadJson('integration-pattern-v1.vectors.json');
  const report = compareNativeIntegrationDecisions(table, vectors);
  const summary = decisionTableCompatibilitySummary(report);

  assert.equal(report.runtimeOwnership.owner, 'decision-tables-as-code');
  assert.equal(report.runtimeOwnership.composerRole, 'orchestration-and-native-equivalence-fixtures');
  assert.equal(summary.evaluatorImplementedInComposer, false);
  assert.equal(summary.nativeVectorCount, summary.nativeMatchCount);
});

test('native/table divergence is visible rather than silently tolerated', async () => {
  const table = await loadJson('integration-pattern-v1.json');
  const vectors = await loadJson('integration-pattern-v1.vectors.json');
  table.rules.find((rule) => rule.id === 'analytics').then.pattern_id = 'pattern.sync-api';
  const report = compareNativeIntegrationDecisions(table, vectors);

  assert.equal(report.deterministicNativeEquivalence, false);
  assert.ok(report.mismatches.some((item) => item.id === 'analytics'));
});

test('prototype rejects unsupported fields instead of drifting from upstream contract', async () => {
  const table = await loadJson('integration-pattern-v1.json');
  table.rules[0].weight = 0.9;
  const validation = validateDecisionTableCompatibilityShape(table);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((item) => item.includes("unsupported field 'weight'")));
});
