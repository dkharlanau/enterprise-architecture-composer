import test from 'node:test';
import assert from 'node:assert/strict';
import { composeArchitecture } from '../src/composer.mjs';
import {
  architectureReviewHtml,
  architectureReviewMarkdown,
  createArchitectureReview
} from '../src/review-report.mjs';

test('review separates unknowns from architecture gaps and operational decisions', () => {
  const result = composeArchitecture({
    processes: ['plan-to-produce'],
    requireExplicitNfrs: true
  });
  const review = createArchitectureReview(result);

  assert.ok(review.unknowns.some((item) => item.kind === 'nfr-decision'));
  assert.ok(review.gaps.some((item) => item.id === 'quality.process-isolated-system.plan-to-produce'));
  assert.ok(review.operationalDecisions.some((item) => item.kind === 'operational-decision'));
  assert.equal(review.status, 'attention-required');
});

test('every review finding carries stable object and rule references', () => {
  const review = createArchitectureReview(composeArchitecture({
    processes: ['order-to-cash', 'procure-to-pay'],
    constraints: { multiCompany: true }
  }));
  for (const finding of [...review.unknowns, ...review.gaps, ...review.operationalDecisions]) {
    assert.ok(finding.id);
    assert.ok(Array.isArray(finding.objectIds));
    assert.ok(Array.isArray(finding.ruleIds));
    assert.ok(finding.ruleIds.length >= 1);
  }
});

test('human override appears separately from Composer proposal in the review', () => {
  const review = createArchitectureReview(composeArchitecture({
    processes: ['order-to-cash'],
    architectureDecisions: [{
      recommendationId: 'rec.integration.sales-order-request',
      status: 'overridden',
      selectedDecision: 'pattern.async-message',
      rationale: 'Approved asynchronous operating model.'
    }]
  }));
  const integration = review.target.integrations.find((item) => item.id === 'integration.sales-order-request');
  const decision = review.humanDecisions[0];

  assert.equal(integration.proposedPatternId, 'pattern.sync-api');
  assert.equal(integration.effectivePatternId, 'pattern.async-message');
  assert.equal(integration.effectiveDecisionSource, 'human');
  assert.equal(decision.originalDecision, 'pattern.sync-api');
  assert.equal(decision.effectiveDecision, 'pattern.async-message');
});

test('Markdown review is deterministic and useful without the UI', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash'],
    requireExplicitNfrs: true
  });
  const one = architectureReviewMarkdown(createArchitectureReview(result));
  const two = architectureReviewMarkdown(createArchitectureReview(result));
  assert.equal(one, two);
  assert.match(one, /^# Enterprise Architecture Review/m);
  assert.match(one, /## Unknowns \/ decisions to confirm/);
  assert.match(one, /## Architecture gaps/);
  assert.match(one, /## Operational \/ security decisions/);
  assert.match(one, /## Delivery roadmap/);
  assert.match(one, /Rule\(s\):/);
  assert.match(one, /Object\(s\):/);
});

test('HTML review is deterministic, standalone and contains escaped Markdown review content', () => {
  const review = createArchitectureReview(composeArchitecture({ processes: ['order-to-cash'] }));
  const html = architectureReviewHtml(review);
  assert.equal(html, architectureReviewHtml(review));
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /Enterprise Architecture Review/);
  assert.doesNotMatch(html, /<script|https?:\/\//i);
});

test('orphaned human decision keeps the review in attention-required state', () => {
  const first = composeArchitecture({
    processes: ['order-to-cash'],
    architectureDecisions: [{ recommendationId: 'rec.integration.sales-order-request', status: 'accepted' }]
  });
  const changed = composeArchitecture({
    processes: ['record-to-report'],
    architectureDecisions: first.context.architectureDecisions
  });
  const review = createArchitectureReview(changed);

  assert.equal(review.status, 'attention-required');
  assert.equal(review.summary.orphanedHumanDecisionCount, 1);
  assert.ok(review.unknowns.some((item) => item.kind === 'decision-drift'));
});
