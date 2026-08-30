import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { composeArchitecture } from '../src/engine.mjs';

const GOLDEN = {
  'o2c-starter.context.json': {
    processCount: 1,
    capabilityCount: 5,
    systemCount: 4,
    integrationCount: 3,
    asyncIntegrationCount: 2,
    unresolvedDataOwnerCount: 2,
    findingCount: 4,
    workPackageCount: 7
  },
  'global-b2b-manufacturer.context.json': {
    processCount: 3,
    capabilityCount: 12,
    systemCount: 7,
    integrationCount: 7,
    asyncIntegrationCount: 6,
    unresolvedDataOwnerCount: 0,
    findingCount: 8,
    workPackageCount: 14
  },
  'partner-procurement.context.json': {
    processCount: 2,
    capabilityCount: 5,
    systemCount: 5,
    integrationCount: 3,
    asyncIntegrationCount: 3,
    unresolvedDataOwnerCount: 2,
    findingCount: 6,
    workPackageCount: 8
  }
};

async function loadScenario(name) {
  const url = new URL(`../examples/scenarios/${name}`, import.meta.url);
  return JSON.parse(await readFile(url, 'utf8'));
}

for (const [name, expected] of Object.entries(GOLDEN)) {
  test(`golden summary remains stable: ${name}`, async () => {
    const result = composeArchitecture(await loadScenario(name));
    assert.deepEqual(result.metrics, expected);
  });
}
