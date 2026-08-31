import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = resolve(root, 'bin/eac.mjs');
const scenario = resolve(root, 'examples/scenarios/o2c-starter.context.json');
const adoptionDecisions = resolve(root, 'examples/handoff/interface-adoption-decisions.sample.json');

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

test('process-starter CLI emits Process-as-Code v0.2 starter', () => {
  const output = JSON.parse(run(['process-starter', scenario, 'order-to-cash']));
  assert.equal(output.version, '0.2');
  assert.equal(output.process.id, 'process.order-to-cash');
  assert.equal(output.steps[0].agent.executable, false);
});

test('interface proposal can be explicitly adopted into Interface-as-Code v1.0 via CLI', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eac-handoff-'));
  try {
    const proposal = run(['interface-proposal', scenario, 'integration.sales-order-request']);
    const proposalPath = join(dir, 'proposal.json');
    writeFileSync(proposalPath, proposal, 'utf8');

    const adopted = JSON.parse(run(['interface-adopt', proposalPath, adoptionDecisions]));
    assert.equal(adopted.version, '1.0');
    assert.equal(adopted.interface.lifecycle, 'proposed');
    assert.equal(adopted.contract.format, 'REST');
    assert.equal(adopted.delivery.guarantee, 'at-least-once');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
