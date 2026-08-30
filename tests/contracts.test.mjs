import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { composeArchitecture, RULES as ENGINE_RULES } from '../src/engine.mjs';
import { RULEBOOK, ruleById } from '../src/rulebook.mjs';

const SCENARIOS = [
  'global-b2b-manufacturer.context.json',
  'o2c-starter.context.json',
  'partner-procurement.context.json'
];

async function loadScenario(name) {
  const url = new URL(`../examples/scenarios/${name}`, import.meta.url);
  return JSON.parse(await readFile(url, 'utf8'));
}

test('rulebook contains at least twenty stable reference rules with unique IDs', () => {
  assert.ok(RULEBOOK.length >= 20, `expected >=20 rules, got ${RULEBOOK.length}`);
  const ids = RULEBOOK.map((rule) => rule.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const rule of RULEBOOK) {
    assert.match(rule.id, /^[A-Z]+(?:-[A-Z]+)*-\d{3}$/);
    assert.ok(['experimental', 'fixture-backed', 'documented', 'stable'].includes(rule.maturity));
    assert.ok(rule.description.length > 20);
  }
});

test('every currently implemented engine rule is registered in the public rulebook', () => {
  for (const rule of ENGINE_RULES) {
    const registered = ruleById(rule.id);
    assert.ok(registered, `missing rulebook entry for ${rule.id}`);
    assert.equal(registered.implemented, true, `${rule.id} must be marked implemented`);
  }
});

test('all reference scenario files compose successfully and keep stable semantic IDs', async () => {
  for (const scenarioName of SCENARIOS) {
    const input = await loadScenario(scenarioName);
    const result = composeArchitecture(input);

    assert.equal(result.schemaVersion, '0.1');
    assert.ok(result.blueprint.processes.length >= 1);
    assert.ok(result.workPackages.length >= 1);

    const allIds = [
      ...result.blueprint.processes,
      ...result.blueprint.capabilities,
      ...result.blueprint.systems,
      ...result.blueprint.dataObjects,
      ...result.blueprint.integrations,
      ...result.recommendations,
      ...result.findings,
      ...result.workPackages
    ].map((item) => item.id);

    assert.equal(new Set(allIds).size, allIds.length, `${scenarioName} contains duplicate semantic IDs`);

    for (const recommendation of result.recommendations) {
      for (const ruleId of recommendation.ruleIds) {
        assert.ok(ruleById(ruleId), `${scenarioName}: unknown recommendation rule ${ruleId}`);
      }
    }

    for (const finding of result.findings) {
      for (const ruleId of finding.ruleIds) {
        assert.ok(ruleById(ruleId), `${scenarioName}: unknown finding rule ${ruleId}`);
      }
    }
  }
});

test('reference scenarios exercise materially different architecture outcomes', async () => {
  const results = [];
  for (const scenarioName of SCENARIOS) {
    results.push(composeArchitecture(await loadScenario(scenarioName)));
  }

  const fingerprints = results.map((result) => JSON.stringify({
    processes: result.metrics.processCount,
    systems: result.metrics.systemCount,
    integrations: result.metrics.integrationCount,
    findings: result.metrics.findingCount,
    work: result.metrics.workPackageCount
  }));

  assert.equal(new Set(fingerprints).size, SCENARIOS.length);
});
