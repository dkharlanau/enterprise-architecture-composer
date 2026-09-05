#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { composeArchitecture } from '../src/composer.mjs';
import { buildDeliveryRoadmap } from '../src/roadmap.mjs';
import {
  applyGitHubIssuePlan,
  createGitHubRestAdapter,
  roadmapToGitHubIssuePlan
} from '../src/github-issues.mjs';

function usage() {
  console.error(`Usage:
  node bin/eac-github-issues.mjs plan <context.json> --repo owner/repo
    [--approval-ref ref] [--title-prefix prefix] [--output issue-plan.json]

  node bin/eac-github-issues.mjs apply <issue-plan.json> --confirm
    [--token-env GITHUB_TOKEN] [--output apply-result.json]

The plan command is the dry-run surface and performs no network writes.
Apply refuses unapproved plans and requires --confirm plus a token from the named environment variable.`);
}

function readOption(args, name, fallback = null) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(process.cwd(), path), 'utf8'));
}

async function emit(value, path = null) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (path) await writeFile(resolve(process.cwd(), path), serialized, 'utf8');
  else process.stdout.write(serialized);
}

async function main(argv) {
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
    usage();
    return;
  }

  const [command, first, ...rest] = argv;

  if (command === 'plan' && first) {
    const repository = readOption(rest, '--repo');
    if (!repository) throw new Error('--repo owner/repo is required');
    const approvalRef = readOption(rest, '--approval-ref');
    const titlePrefix = readOption(rest, '--title-prefix', '[EAC]');
    const output = readOption(rest, '--output');

    const context = await readJson(first);
    const roadmap = buildDeliveryRoadmap(composeArchitecture(context));
    const plan = roadmapToGitHubIssuePlan(roadmap, {
      repository,
      approvalRef,
      titlePrefix
    });
    await emit(plan, output);
    return;
  }

  if (command === 'apply' && first) {
    if (!rest.includes('--confirm')) {
      console.error('eac-github-issues: refusing apply without --confirm. Review the plan first.');
      process.exitCode = 3;
      return;
    }
    const output = readOption(rest, '--output');
    const tokenEnv = readOption(rest, '--token-env', 'GITHUB_TOKEN');
    const plan = await readJson(first);
    if (!plan.readyForApply || !plan.approvalRef) {
      console.error('eac-github-issues: refusing apply because the plan has no approvalRef. Regenerate it with --approval-ref.');
      process.exitCode = 3;
      return;
    }
    const token = process.env[tokenEnv];
    if (!token) {
      console.error(`eac-github-issues: ${tokenEnv} is not set.`);
      process.exitCode = 4;
      return;
    }

    const adapter = createGitHubRestAdapter(token);
    const result = await applyGitHubIssuePlan(plan, adapter);
    await emit(result, output);
    return;
  }

  usage();
  process.exitCode = 2;
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`eac-github-issues: ${error.message}`);
  process.exitCode = 1;
});
