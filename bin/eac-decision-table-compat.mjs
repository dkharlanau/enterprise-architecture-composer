#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  compareNativeIntegrationDecisions,
  decisionTableCompatibilitySummary
} from '../src/decision-table-compat.mjs';

const defaultTable = 'compatibility/decision-tables/integration-pattern-v1.json';
const defaultVectors = 'compatibility/decision-tables/integration-pattern-v1.vectors.json';

function option(args, name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(process.cwd(), path), 'utf8'));
}

async function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.error(`Usage:
  node bin/eac-decision-table-compat.mjs
    [--table table.json]
    [--vectors vectors.json]
    [--summary]
    [--output report.json]

This command does not execute Decision Tables as Code. It compares the table rule outputs named by golden vectors with native Composer decisions.`);
    return;
  }

  const tablePath = option(argv, '--table', defaultTable);
  const vectorsPath = option(argv, '--vectors', defaultVectors);
  const output = option(argv, '--output', null);
  const report = compareNativeIntegrationDecisions(
    await readJson(tablePath),
    await readJson(vectorsPath)
  );
  const value = argv.includes('--summary') ? decisionTableCompatibilitySummary(report) : report;
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (output) await writeFile(resolve(process.cwd(), output), serialized, 'utf8');
  else process.stdout.write(serialized);

  if (!report.deterministicNativeEquivalence) process.exitCode = 3;
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`eac-decision-table-compat: ${error.message}`);
  process.exitCode = 1;
});
