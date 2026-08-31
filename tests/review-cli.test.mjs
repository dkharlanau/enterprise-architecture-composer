import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = resolve(root, 'bin/eac-review.mjs');
const scenario = resolve(root, 'examples/scenarios/o2c-starter.context.json');

function run(args) {
  return execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
}

test('review CLI defaults to deterministic Markdown', () => {
  const output = run([scenario]);
  assert.match(output, /^# Enterprise Architecture Review/m);
  assert.match(output, /## Review summary/);
});

test('review CLI emits machine-readable JSON', () => {
  const output = JSON.parse(run([scenario, '--format', 'json']));
  assert.equal(output.schemaVersion, '0.1');
  assert.equal(output.title, 'Enterprise Architecture Review');
  assert.ok(['ready-for-review', 'attention-required', 'blocked'].includes(output.status));
});

test('review CLI emits standalone HTML', () => {
  const output = run([scenario, '--format', 'html']);
  assert.match(output, /^<!doctype html>/);
  assert.match(output, /Enterprise Architecture Review/);
  assert.doesNotMatch(output, /<script/i);
});
