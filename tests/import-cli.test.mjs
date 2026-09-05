import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = resolve(root, 'bin/eac-import.mjs');
const base = resolve(root, 'examples/scenarios/o2c-starter.context.json');
const applications = resolve(root, 'examples/import/application-inventory.csv');
const interfaces = resolve(root, 'examples/import/interface-inventory.csv');
const backstage = resolve(root, 'examples/import/backstage-entities.json');

function run(args) {
  return execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
}

test('landscape import CLI merges application and interface inventories without silent loss', () => {
  const output = JSON.parse(run([
    base,
    '--applications', applications,
    '--interfaces', interfaces
  ]));

  assert.equal(output.conflicts.length, 0);
  assert.ok(output.context.currentLandscape.systems.some((item) => item.id === 'app.legacy-wms'));
  assert.ok(output.context.currentLandscape.integrations.some((item) => item.id === 'if.erp-wms'));
  assert.ok(output.evidence.some((item) => item.provenance.sourceType === 'csv'));
});

test('landscape import CLI uses typed system-role resolution for Backstage entities', () => {
  const output = JSON.parse(run([base, '--backstage', backstage]));
  assert.equal(output.conflicts.length, 0);
  const warehouse = output.context.currentLandscape.systems.find((item) => item.id === 'app.backstage.warehouse-platform');
  assert.equal(warehouse.roleId, 'sys.wms');
});
