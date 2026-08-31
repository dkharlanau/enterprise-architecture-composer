import test from 'node:test';
import assert from 'node:assert/strict';
import { composeArchitecture } from '../src/composer.mjs';
import { validateArchitectureDecisions } from '../src/decisions.mjs';
import { createPortableBundle, restoreContextFromBundle, verifyBundleRecomposition } from '../src/export.mjs';

test('accepted recommendation becomes an explicit effective human decision without rewriting proposal semantics', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash'],
    architectureDecisions: [
      { recommendationId: 'rec.integration.sales-order-request', status: 'accepted' }
    ]
  });

  const record = result.decisionRecords[0];
  const integration = result.blueprint.integrations.find((item) => item.id === 'integration.sales-order-request');
  assert.equal(record.status, 'accepted');
  assert.equal(record.effectiveDecision, 'pattern.sync-api');
  assert.equal(record.sourceRecommendation.decision, 'pattern.sync-api');
  assert.equal(integration.patternId, 'pattern.sync-api');
  assert.equal(integration.decisionAnalysis.effectivePatternId, 'pattern.sync-api');
  assert.equal(integration.decisionAnalysis.effectiveDecisionSource, 'human');
});

test('override requires rationale and preserves original recommendation snapshot', () => {
  assert.equal(validateArchitectureDecisions([
    { recommendationId: 'rec.integration.sales-order-request', status: 'overridden', selectedDecision: 'pattern.async-message' }
  ]).valid, false);

  const result = composeArchitecture({
    processes: ['order-to-cash'],
    architectureDecisions: [
      {
        recommendationId: 'rec.integration.sales-order-request',
        status: 'overridden',
        selectedDecision: 'pattern.async-message',
        rationale: 'The calling channel accepts asynchronous confirmation and prioritizes outage isolation.'
      }
    ]
  });

  const record = result.decisionRecords[0];
  const recommendation = result.recommendations.find((item) => item.id === record.recommendationId);
  const integration = result.blueprint.integrations.find((item) => item.id === 'integration.sales-order-request');
  assert.equal(record.sourceRecommendation.decision, 'pattern.sync-api');
  assert.equal(record.effectiveDecision, 'pattern.async-message');
  assert.equal(recommendation.decision, 'pattern.sync-api');
  assert.equal(recommendation.humanDecision.effectiveDecision, 'pattern.async-message');
  assert.equal(integration.patternId, 'pattern.sync-api');
  assert.equal(integration.decisionAnalysis.effectivePatternId, 'pattern.async-message');
  assert.equal(result.metrics.humanOverrideCount, 1);
});

test('rejected recommendation has no effective decision but the proposal remains inspectable', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash'],
    architectureDecisions: [
      {
        recommendationId: 'rec.integration.delivery-to-warehouse',
        status: 'rejected',
        rationale: 'Warehouse integration is explicitly out of the current release scope.'
      }
    ]
  });

  const record = result.decisionRecords[0];
  const integration = result.blueprint.integrations.find((item) => item.id === 'integration.delivery-to-warehouse');
  assert.equal(record.effectiveDecision, null);
  assert.equal(integration.patternId, 'pattern.async-message');
  assert.equal(integration.decisionAnalysis.effectivePatternId, null);
  assert.equal(integration.decisionAnalysis.humanDecisionStatus, 'rejected');
});

test('decision records survive recomposition and portable bundle roundtrip', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash'],
    architectureDecisions: [
      {
        recommendationId: 'rec.integration.sales-order-request',
        status: 'overridden',
        selectedDecision: 'pattern.async-message',
        rationale: 'Approved asynchronous operating model.'
      }
    ]
  });
  const bundle = createPortableBundle(result);
  const restored = restoreContextFromBundle(bundle);
  const recomposed = composeArchitecture(restored);

  assert.equal(verifyBundleRecomposition(bundle).matches, true);
  assert.deepEqual(recomposed.decisionRecords, result.decisionRecords);
  assert.deepEqual(restored.architectureDecisions, result.context.architectureDecisions);
});

test('human decision is retained as orphaned decision drift when its recommendation disappears', () => {
  const first = composeArchitecture({
    processes: ['order-to-cash'],
    architectureDecisions: [
      {
        recommendationId: 'rec.integration.sales-order-request',
        status: 'accepted'
      }
    ]
  });
  const changed = composeArchitecture({
    processes: ['record-to-report'],
    architectureDecisions: first.context.architectureDecisions
  });

  assert.equal(changed.decisionRecords.length, 1);
  assert.equal(changed.decisionRecords[0].applies, false);
  assert.equal(changed.decisionRecords[0].sourceRecommendation.decision, 'pattern.sync-api');
  assert.equal(changed.metrics.orphanedDecisionCount, 1);
  assert.ok(changed.findings.some((item) => item.kind === 'decision-drift' && item.ruleIds.includes('DECISION-ORPHAN-001')));
});

test('duplicate decisions for one recommendation are rejected deterministically', () => {
  const validation = validateArchitectureDecisions([
    { recommendationId: 'rec.integration.sales-order-request', status: 'accepted' },
    { recommendationId: 'rec.integration.sales-order-request', status: 'rejected', rationale: 'duplicate' }
  ]);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((message) => message.includes('Multiple architecture decisions')));
});
