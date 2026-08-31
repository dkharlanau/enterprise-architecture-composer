import test from 'node:test';
import assert from 'node:assert/strict';
import { composeArchitecture } from '../src/composer.mjs';

test('default NFR enrichment preserves the existing blueprint decisions', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash', 'procure-to-pay', 'record-to-report'],
    constraints: { highVolume: true }
  });

  for (const integration of result.blueprint.integrations) {
    assert.equal(integration.decisionAnalysis.selectedMatchesBlueprint, true, integration.id);
    assert.ok(integration.decisionAnalysis.alternatives.length >= 6);
  }
});

test('explicit per-flow NFR profile can challenge the catalog default without silently changing it', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash'],
    integrationProfiles: {
      'integration.delivery-to-warehouse': {
        latency: 'hours',
        consistency: 'snapshot',
        payloadSize: 'very-large',
        replay: 'desirable',
        offlineTolerance: 'extended',
        purpose: 'state-transfer'
      }
    }
  });

  const integration = result.blueprint.integrations.find((item) => item.id === 'integration.delivery-to-warehouse');
  assert.equal(integration.patternId, 'pattern.async-message');
  assert.equal(integration.decisionAnalysis.recommendedPatternId, 'pattern.batch-file');
  assert.equal(integration.decisionAnalysis.selectedMatchesBlueprint, false);
  assert.ok(result.findings.some((item) => item.id === 'finding.integration-profile.delivery-to-warehouse'));
});

test('integration recommendations expose categorical alternative analysis', () => {
  const result = composeArchitecture({ processes: ['order-to-cash'] });
  const recommendation = result.recommendations.find((item) => item.id === 'rec.integration.sales-order-request');
  assert.ok(recommendation.alternativeAnalysis.length >= 6);
  assert.ok(recommendation.alternativeAnalysis.every((item) => ['acceptable', 'disfavored', 'incompatible', 'preferred'].includes(item.fit)));
  assert.ok(recommendation.alternativeAnalysis.every((item) => Array.isArray(item.tradeoffs)));
});

test('conflicting integration drivers become explicit findings', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash'],
    integrationProfiles: {
      'integration.sales-order-request': {
        latency: 'immediate',
        consistency: 'strong',
        offlineTolerance: 'extended',
        partnerBoundary: true,
        fanOut: 2
      }
    }
  });

  assert.ok(result.findings.some((item) => item.kind === 'integration-driver-conflict'));
});
