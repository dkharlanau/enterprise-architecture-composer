#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { composeArchitecture } from '../src/composer.mjs';
import {
  provenanceForCatalogObject,
  provenanceForRecommendation,
  provenanceForRule,
  resultProvenance,
  stalenessReport
} from '../src/provenance.mjs';

function usage() {
  console.error(`Usage:
  node bin/eac-provenance.mjs result <context.json> [--as-of YYYY-MM-DD] [--output provenance.json]
  node bin/eac-provenance.mjs rule <rule-id>
  node bin/eac-provenance.mjs object <catalog-object-id>
  node bin/eac-provenance.mjs recommendation <context.json> <recommendation-id>
  node bin/eac-provenance.mjs stale --as-of YYYY-MM-DD`);
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index < 0 ? null : args[index + 1] ?? null;
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(process.cwd(), path), 'utf8'));
}

async function emit(value, output = null) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (output) await writeFile(resolve(process.cwd(), output), text, 'utf8');
  else process.stdout.write(text);
}

async function main(argv) {
  const [command, first, second, ...rest] = argv;

  if (command === 'result' && first) {
    const args = [second, ...rest].filter(Boolean);
    const asOf = optionValue(args, '--as-of');
    const output = optionValue(args, '--output');
    if (args.includes('--as-of') && !asOf) throw new Error('--as-of requires YYYY-MM-DD');
    if (args.includes('--output') && !output) throw new Error('--output requires a path');
    const result = composeArchitecture(await readJson(first));
    await emit(resultProvenance(result, asOf ? { asOf } : {}), output);
    return;
  }

  if (command === 'rule' && first) {
    await emit(provenanceForRule(first));
    return;
  }

  if (command === 'object' && first) {
    await emit(provenanceForCatalogObject(first));
    return;
  }

  if (command === 'recommendation' && first && second) {
    const result = composeArchitecture(await readJson(first));
    const recommendation = result.recommendations.find((item) => item.id === second);
    if (!recommendation) throw new Error(`Recommendation not found: ${second}`);
    await emit(provenanceForRecommendation(recommendation));
    return;
  }

  if (command === 'stale') {
    const args = [first, second, ...rest].filter(Boolean);
    const asOf = optionValue(args, '--as-of');
    if (!asOf) throw new Error('stale requires --as-of YYYY-MM-DD');
    await emit(stalenessReport(asOf));
    return;
  }

  usage();
  process.exitCode = 2;
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`eac-provenance: ${error.message}`);
  process.exitCode = 1;
});
