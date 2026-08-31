import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = resolve(root, 'bin/eac-provenance.mjs');
const scenario = resolve(root, 'examples/scenarios/o2c-starter.context.json');

function run(args) {
  return execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
}

test('provenance CLI resolves one rule', () => {
  const output = JSON.parse(run(['rule', 'INT-SYNC-001']));
  assert.equal(output.status, 'resolved');
  assert.equal(output.ruleId, 'INT-SYNC-001');
  assert.ok(output.sources.some((source) => source.evidenceType === 'heuristic'));
});

test('provenance CLI resolves one catalog object', () => {
  const output = JSON.parse(run(['object', 'sys.erp']));
  assert.equal(output.status, 'resolved');
  assert.equal(output.objectId, 'sys.erp');
});

test('provenance CLI explains one composed recommendation', () => {
  const output = JSON.parse(run(['recommendation', scenario, 'rec.integration.sales-order-request']));
  assert.ok(output.rules.some((item) => item.ruleId === 'INT-SYNC-001'));
  assert.ok(output.sources.length > 0);
});

test('provenance CLI produces result audit with explicit staleness date', () => {
  const output = JSON.parse(run(['result', scenario, '--as-of', '2026-08-31']));
  assert.equal(output.staleness.asOf, '2026-08-31');
  assert.ok(output.staleness.sources.every((item) => item.status === 'current'));
});

test('staleness CLI reports later review debt without editing architecture', () => {
  const output = JSON.parse(run(['stale', '--as-of', '2027-03-01']));
  assert.equal(output.asOf, '2027-03-01');
  assert.ok(output.sources.some((item) => item.status === 'stale'));
});
