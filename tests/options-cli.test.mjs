import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = resolve(root, 'bin/eac-options.mjs');
const example = resolve(root, 'examples/options/record-to-report-options.json');

test('option comparison CLI emits a score-free matrix', () => {
  const output = JSON.parse(execFileSync(process.execPath, [cli, example], { cwd: root, encoding: 'utf8' }));
  assert.equal(output.schemaVersion, '0.1');
  assert.equal(output.method.scoreFree, true);
  assert.equal(output.options.length, 3);
  assert.ok(output.preferredOptionIds.length >= 1);
  assert.equal(Object.hasOwn(output, 'score'), false);
});
