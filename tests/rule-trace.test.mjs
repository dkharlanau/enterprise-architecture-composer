import test from 'node:test';
import assert from 'node:assert/strict';
import { composeArchitecture } from '../src/composer.mjs';
import { RULEBOOK } from '../src/rulebook.mjs';

function emittedRuleIds(result) {
  const ids = new Set();
  for (const recommendation of result.recommendations ?? []) {
    for (const id of recommendation.ruleIds ?? []) ids.add(id);
    for (const alternative of recommendation.alternativeAnalysis ?? []) {
      for (const id of alternative.ruleIds ?? []) ids.add(id);
    }
  }
  for (const finding of result.findings ?? []) for (const id of finding.ruleIds ?? []) ids.add(id);
  for (const integration of result.blueprint?.integrations ?? []) {
    for (const id of integration.ruleIds ?? []) ids.add(id);
    for (const alternative of integration.decisionAnalysis?.alternatives ?? []) {
      for (const id of alternative.ruleIds ?? []) ids.add(id);
    }
  }
  for (const replacement of result.transition?.replacements ?? []) for (const id of replacement.ruleIds ?? []) ids.add(id);
  for (const dependency of result.transition?.dependencies ?? []) for (const id of dependency.ruleIds ?? []) ids.add(id);
  return [...ids].sort();
}

const scenarios = [
  { processes: ['order-to-cash'] },
  { processes: ['plan-to-produce'] },
  { processes: ['record-to-report'], requireExplicitNfrs: true },
  {
    processes: ['order-to-cash', 'procure-to-pay'],
    constraints: { multiCompany: true, highVolume: true },
    integrationProfiles: {
      'integration.sales-order-request': {
        latency: 'immediate',
        consistency: 'strong',
        offlineTolerance: 'extended',
        partnerBoundary: true,
        fanOut: 2
      }
    }
  },
  {
    processes: ['order-to-cash'],
    currentLandscape: {
      systems: [
        { id: 'app.erp', name: 'ERP', roleId: 'sys.erp', strategy: 'keep' },
        { id: 'app.crm', name: 'CRM', roleId: 'sys.crm', strategy: 'keep' },
        { id: 'app.wms', name: 'Legacy WMS', roleId: 'sys.wms', strategy: 'replace', replacementRoleId: 'sys.wms' }
      ]
    }
  }
];

test('every rule emitted by representative public Composer scenarios is registered', () => {
  const registered = new Set(RULEBOOK.map((rule) => rule.id));
  const emitted = new Set();
  for (const context of scenarios) {
    for (const id of emittedRuleIds(composeArchitecture(context))) emitted.add(id);
  }
  const missing = [...emitted].filter((id) => !registered.has(id)).sort();
  assert.deepEqual(missing, []);
});

test('decision drift rule is registered when retained human decision becomes orphaned', () => {
  const first = composeArchitecture({
    processes: ['order-to-cash'],
    architectureDecisions: [{ recommendationId: 'rec.integration.sales-order-request', status: 'accepted' }]
  });
  const changed = composeArchitecture({
    processes: ['record-to-report'],
    architectureDecisions: first.context.architectureDecisions
  });
  const registered = new Set(RULEBOOK.map((rule) => rule.id));
  const emitted = emittedRuleIds(changed);
  assert.ok(emitted.includes('DECISION-ORPHAN-001'));
  assert.ok(emitted.every((id) => registered.has(id)));
});
