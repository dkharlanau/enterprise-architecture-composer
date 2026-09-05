#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  importApplicationInventoryCsv,
  importBackstageEntities,
  importInterfaceAsCode,
  importInterfaceInventoryCsv,
  importProcessAsCode,
  mergeImportedConstraints
} from '../src/import-landscape.mjs';

function usage() {
  console.error(`Usage:
  node bin/eac-import.mjs <base-context.json>
    [--applications applications.csv]
    [--interfaces interfaces.csv]
    [--backstage backstage.json]
    [--process process-as-code.json ...]
    [--interface interface-as-code.json ...]
    [--output imported-context.json]

The output contains { context, evidence, conflicts }. Imported facts never overwrite
conflicting current-state instances silently.`);
}

function collectArgs(args) {
  const out = {
    base: args[0] ?? null,
    applications: [],
    interfaces: [],
    backstage: [],
    process: [],
    interface: [],
    output: null
  };
  const multi = new Set(['--applications', '--interfaces', '--backstage', '--process', '--interface']);
  for (let index = 1; index < args.length; index += 1) {
    const token = args[index];
    if (multi.has(token)) {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${token} requires a path`);
      out[token.slice(2)].push(value);
      index += 1;
      continue;
    }
    if (token === '--output') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--output requires a path');
      out.output = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return out;
}

async function readText(path) {
  return readFile(resolve(process.cwd(), path), 'utf8');
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

async function main(argv) {
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
    usage();
    return;
  }

  const input = collectArgs(argv);
  if (!input.base) {
    usage();
    process.exitCode = 2;
    return;
  }

  const baseContext = await readJson(input.base);
  const imports = [];

  for (const path of input.applications) {
    imports.push(importApplicationInventoryCsv(await readText(path), { sourceId: `file:${path}` }));
  }
  for (const path of input.interfaces) {
    imports.push(importInterfaceInventoryCsv(await readText(path), { sourceId: `file:${path}` }));
  }
  for (const path of input.backstage) {
    imports.push(importBackstageEntities(await readJson(path), { sourceId: `file:${path}` }));
  }
  for (const path of input.process) {
    imports.push(importProcessAsCode(await readJson(path), { sourceId: `file:${path}` }));
  }
  for (const path of input.interface) {
    imports.push(importInterfaceAsCode(await readJson(path), { sourceId: `file:${path}` }));
  }

  const merged = mergeImportedConstraints(baseContext, imports);
  const serialized = `${JSON.stringify(merged, null, 2)}\n`;
  if (input.output) await writeFile(resolve(process.cwd(), input.output), serialized, 'utf8');
  else process.stdout.write(serialized);

  if (merged.conflicts.some((item) => item.severity === 'error')) process.exitCode = 3;
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`eac-import: ${error.message}`);
  process.exitCode = 1;
});
