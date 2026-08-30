#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { composeArchitecture, serializeComposition } from '../src/engine.mjs';
import { diffCompositions } from '../src/diff.mjs';

function usage() {
  console.error(`Usage:
  node bin/eac.mjs compose <context.json> [--output blueprint.json]
  node bin/eac.mjs compare <base-context.json> <target-context.json> [--output delta.json]`);
}

function outputPath(rest) {
  const index = rest.indexOf('--output');
  if (index < 0) return null;
  return rest[index + 1] ?? null;
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
  const [command, first, second, ...rest] = argv;

  if (command === 'compose' && first) {
    const composeRest = [second, ...rest].filter(Boolean);
    const path = outputPath(composeRest);
    if (composeRest.includes('--output') && !path) {
      usage();
      process.exitCode = 2;
      return;
    }

    const result = composeArchitecture(await readJson(first));
    if (path) await writeFile(resolve(process.cwd(), path), serializeComposition(result), 'utf8');
    else process.stdout.write(serializeComposition(result));
    return;
  }

  if (command === 'compare' && first && second) {
    const path = outputPath(rest);
    if (rest.includes('--output') && !path) {
      usage();
      process.exitCode = 2;
      return;
    }

    const base = composeArchitecture(await readJson(first));
    const target = composeArchitecture(await readJson(second));
    await emit(diffCompositions(base, target), path);
    return;
  }

  usage();
  process.exitCode = 2;
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`eac: ${error.message}`);
  process.exitCode = 1;
});
