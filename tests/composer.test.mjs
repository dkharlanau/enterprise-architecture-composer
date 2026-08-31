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
    assert.ok(integration.decisionAnalysis.decisiveBecause.length >= 1);
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

test('integration recommendations expose categorical alternatives and decisive NFR trace', () => {
  const result = composeArchitecture({ processes: ['order-to-cash'] });
  const recommendation = result.recommendations.find((item) => item.id === 'rec.integration.sales-order-request');
  assert.ok(recommendation.alternativeAnalysis.length >= 6);
  assert.ok(recommendation.alternativeAnalysis.every((item) => ['acceptable', 'disfavored', 'incompatible', 'preferred'].includes(item.fit)));
  assert.ok(recommendation.alternativeAnalysis.every((item) => Array.isArray(item.tradeoffs)));
  assert.equal(recommendation.nfrAnalysis.recommendedPatternId, 'pattern.sync-api');
  assert.ok(recommendation.nfrAnalysis.decisiveBecause.some((text) => text.includes('immediate')));
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

test('strict NFR mode exposes catalog defaults that still need explicit confirmation', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash'],
    requireExplicitNfrs: true,
    nfrProfile: {
      volume: 'medium',
      replay: 'desirable'
    }
  });

  const finding = result.findings.find((item) => item.id === 'finding.nfr-explicit.sales-order-request');
  assert.ok(finding);
  assert.equal(finding.kind, 'nfr-decision');
  assert.ok(finding.ruleIds.includes('NFR-EXPLICIT-001'));
  assert.match(finding.message, /latency/);
  assert.equal(result.metrics.explicitNfrGapCount, result.blueprint.integrations.length);
  assert.ok(result.workPackages.find((item) => item.id === 'wp.architecture.resolve-decisions').sourceIds.includes(finding.id));
});

test('strict NFR mode clears the gap when all critical drivers are explicit', () => {
  const complete = {
    latency: 'seconds',
    consistency: 'eventual',
    volume: 'medium',
    replay: 'desirable',
    ordering: 'none',
    offlineTolerance: 'short'
  };
  const result = composeArchitecture({
    processes: ['record-to-report'],
    requireExplicitNfrs: true,
    nfrProfile: complete
  });

  assert.equal(result.metrics.explicitNfrGapCount, 0);
  assert.equal(result.findings.some((item) => item.kind === 'nfr-decision'), false);
  assert.deepEqual(result.blueprint.integrations[0].decisionAnalysis.missingExplicitDrivers, []);
});
