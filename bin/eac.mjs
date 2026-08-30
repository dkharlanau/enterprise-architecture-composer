#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { composeArchitecture, serializeComposition } from '../src/engine.mjs';

function usage() {
  console.error('Usage: node bin/eac.mjs compose <context.json> [--output blueprint.json]');
}

async function main(argv) {
  const [command, inputPath, ...rest] = argv;
  if (command !== 'compose' || !inputPath) {
    usage();
    process.exitCode = 2;
    return;
  }

  const outputIndex = rest.indexOf('--output');
  const outputPath = outputIndex >= 0 ? rest[outputIndex + 1] : null;
  if (outputIndex >= 0 && !outputPath) {
    usage();
    process.exitCode = 2;
    return;
  }

  const absoluteInput = resolve(process.cwd(), inputPath);
  const input = JSON.parse(await readFile(absoluteInput, 'utf8'));
  const result = composeArchitecture(input);
  const serialized = serializeComposition(result);

  if (outputPath) {
    await writeFile(resolve(process.cwd(), outputPath), serialized, 'utf8');
  } else {
    process.stdout.write(serialized);
  }
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`eac: ${error.message}`);
  process.exitCode = 1;
});
