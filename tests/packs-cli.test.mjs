import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = resolve(root, 'bin/eac-packs.mjs');
const automotive = resolve(root, 'packs/industry-automotive.pack.json');
const sap = resolve(root, 'packs/vendor-sap.pack.json');
const scenario = resolve(root, 'examples/scenarios/global-b2b-manufacturer.context.json');

function run(args) {
  return execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
}

test('pack CLI validates multiple published packs as one compatible set', () => {
  const output = JSON.parse(run(['validate', automotive, sap]));
  assert.equal(output.valid, true);
  assert.equal(output.packCount, 2);
  assert.deepEqual(output.errors, []);
  assert.deepEqual(output.validations.map((item) => item.packId), [
    'pack.industry.automotive',
    'pack.vendor.sap'
  ]);
});

test('pack CLI composes the core scenario and emits a separate advisory overlay', () => {
  const output = JSON.parse(run(['compose', scenario, automotive, sap]));

  assert.equal(output.schemaVersion, '0.1');
  assert.equal(output.composition.engineVersion, '0.2.0');
  assert.ok(output.composition.blueprint.systems.some((item) => item.id === 'sys.erp'));
  assert.deepEqual(output.packOverlay.packs.map((item) => item.id), [
    'pack.industry.automotive',
    'pack.vendor.sap'
  ]);
  assert.ok(output.packOverlay.guidance.some((item) => item.packId === 'pack.industry.automotive'));
  assert.ok(output.packOverlay.options.some((item) => item.id === 'pack.vendor.sap.option.s4hana'));
});

test('pack CLI returns validation failure for a pack attempting to replace core rules', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eac-pack-'));
  try {
    const invalidPath = join(dir, 'invalid.pack.json');
    writeFileSync(invalidPath, JSON.stringify({
      format: 'enterprise-architecture-composer/architecture-pack',
      formatVersion: '0.1',
      pack: {
        id: 'pack.vendor.invalid',
        version: '0.1.0',
        kind: 'vendor',
        name: 'Invalid pack',
        description: 'This fixture intentionally violates the pack boundary for CLI validation.'
      },
      evidence: [],
      aliases: [],
      guidance: [],
      options: [],
      rules: [{ id: 'INT-SYNC-001' }]
    }, null, 2));

    const result = spawnSync(process.execPath, [cli, 'validate', invalidPath], {
      cwd: root,
      encoding: 'utf8'
    });
    assert.equal(result.status, 3);
    const output = JSON.parse(result.stdout);
    assert.equal(output.valid, false);
    assert.ok(output.errors.some((item) => item.includes('cannot define or replace core rules')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
