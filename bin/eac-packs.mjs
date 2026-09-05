#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { composeArchitectureWithPacks, validateArchitecturePackSet } from '../src/packs.mjs';

function usage() {
  console.error(`Usage:
  node bin/eac-packs.mjs validate <pack.json> [pack.json ...] [--output validation.json]
  node bin/eac-packs.mjs compose <context.json> [pack.json ...] [--output composition-with-packs.json]

Architecture packs are advisory overlays. They cannot define or replace Composer core rules.`);
}

function extractOutput(args) {
  const rest = [...args];
  const index = rest.indexOf('--output');
  if (index < 0) return { args: rest, output: null };
  const output = rest[index + 1];
  if (!output || output.startsWith('--')) throw new Error('--output requires a path');
  rest.splice(index, 2);
  return { args: rest, output };
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

  const [command, ...raw] = argv;
  const parsed = extractOutput(raw);

  if (command === 'validate') {
    if (!parsed.args.length) throw new Error('validate requires at least one pack path');
    const packs = await Promise.all(parsed.args.map(readJson));
    const validation = validateArchitecturePackSet(packs);
    await emit(validation, parsed.output);
    if (!validation.valid) process.exitCode = 3;
    return;
  }

  if (command === 'compose') {
    const [contextPath, ...packPaths] = parsed.args;
    if (!contextPath) throw new Error('compose requires a context path');
    const context = await readJson(contextPath);
    const packs = await Promise.all(packPaths.map(readJson));
    await emit(composeArchitectureWithPacks(context, packs), parsed.output);
    return;
  }

  usage();
  process.exitCode = 2;
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`eac-packs: ${error.message}`);
  process.exitCode = 1;
});
