#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { compareSolutionOptions } from '../src/options.mjs';

function usage() {
  console.error('Usage: node bin/eac-options.mjs <options.json> [--output comparison.json]');
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index < 0 ? null : args[index + 1] ?? null;
}

async function main(argv) {
  const [path, ...rest] = argv;
  if (!path) {
    usage();
    process.exitCode = 2;
    return;
  }
  const output = optionValue(rest, '--output');
  if (rest.includes('--output') && !output) throw new Error('--output requires a path');
  const document = JSON.parse(await readFile(resolve(process.cwd(), path), 'utf8'));
  const comparison = compareSolutionOptions(document.options ?? document);
  const text = `${JSON.stringify(comparison, null, 2)}\n`;
  if (output) await writeFile(resolve(process.cwd(), output), text, 'utf8');
  else process.stdout.write(text);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`eac-options: ${error.message}`);
  process.exitCode = 1;
});
