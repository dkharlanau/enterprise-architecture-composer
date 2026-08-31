import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = resolve(root, 'bin/eac.mjs');
const scenario = resolve(root, 'examples/scenarios/o2c-starter.context.json');

function run(args) {
  return execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
}

test('compose CLI emits v0.2 enriched blueprint', () => {
  const output = JSON.parse(run(['compose', scenario]));
  assert.equal(output.engineVersion, '0.2.0');
  assert.ok(output.blueprint.integrations.every((item) => item.decisionAnalysis));
});

test('roadmap CLI emits deterministic delivery waves', () => {
  const output = JSON.parse(run(['roadmap', scenario]));
  assert.ok(output.summary.waveCount >= 1);
  assert.ok(output.packages.every((item) => item.wave >= 1));
});

test('report CLI emits reviewable Markdown', () => {
  const output = run(['report', scenario]);
  assert.match(output, /^# Enterprise Architecture Decision Report/m);
  assert.match(output, /## Delivery roadmap/);
});

test('visual CLI emits Visual Workbench projection', () => {
  const output = JSON.parse(run(['visual', scenario]));
  assert.equal(output.visual.kind, 'system-flow');
  assert.ok(output.visual.nodes.length > 0);
});
