import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = resolve(root, 'bin/eac-github-issues.mjs');
const scenario = resolve(root, 'examples/scenarios/o2c-starter.context.json');

function run(args) {
  return execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
}

test('plan command is a network-free dry-run with stable work-package markers', () => {
  const output = JSON.parse(run(['plan', scenario, '--repo', 'example/implementation']));
  assert.equal(output.readyForApply, false);
  assert.equal(output.repository, 'example/implementation');
  assert.ok(output.issues.length > 0);
  assert.ok(output.issues.every((item) => item.idempotencyMarker.includes(item.workPackageId)));
  assert.ok(output.issues.every((item) => item.labels.some((label) => label.startsWith('phase:'))));
});

test('plan command records explicit approval reference before apply can be eligible', () => {
  const output = JSON.parse(run([
    'plan', scenario,
    '--repo', 'example/implementation',
    '--approval-ref', 'architecture-review-2026-09-05'
  ]));
  assert.equal(output.readyForApply, true);
  assert.equal(output.approvalRef, 'architecture-review-2026-09-05');
});

test('apply refuses without explicit --confirm before token or network access', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eac-gh-issues-'));
  try {
    const planPath = join(dir, 'plan.json');
    writeFileSync(planPath, run([
      'plan', scenario,
      '--repo', 'example/implementation',
      '--approval-ref', 'approved'
    ]), 'utf8');

    const result = spawnSync(process.execPath, [cli, 'apply', planPath], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_TOKEN: '' }
    });
    assert.equal(result.status, 3);
    assert.match(result.stderr, /refusing apply without --confirm/);
    assert.doesNotMatch(result.stderr, /GITHUB_TOKEN is not set/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('apply refuses a dry-run plan without approvalRef even when --confirm is present', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eac-gh-issues-'));
  try {
    const planPath = join(dir, 'plan.json');
    writeFileSync(planPath, run(['plan', scenario, '--repo', 'example/implementation']), 'utf8');

    const result = spawnSync(process.execPath, [cli, 'apply', planPath, '--confirm'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_TOKEN: '' }
    });
    assert.equal(result.status, 3);
    assert.match(result.stderr, /plan has no approvalRef/);
    assert.doesNotMatch(result.stderr, /GITHUB_TOKEN is not set/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('confirmed approved apply still requires token from environment rather than command line', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eac-gh-issues-'));
  try {
    const planPath = join(dir, 'plan.json');
    writeFileSync(planPath, run([
      'plan', scenario,
      '--repo', 'example/implementation',
      '--approval-ref', 'approved'
    ]), 'utf8');

    const result = spawnSync(process.execPath, [cli, 'apply', planPath, '--confirm'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_TOKEN: '' }
    });
    assert.equal(result.status, 4);
    assert.match(result.stderr, /GITHUB_TOKEN is not set/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
