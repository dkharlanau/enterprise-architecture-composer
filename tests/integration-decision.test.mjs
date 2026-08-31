import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideIntegrationPattern,
  evaluateIntegrationPatterns,
  normalizeIntegrationDrivers,
  patternToInterfaceSemantics
} from '../src/integration-decision.mjs';

test('immediate strong-consistency request prefers synchronous API and explains async tradeoff', () => {
  const result = decideIntegrationPattern({
    immediateResponse: true,
    latency: 'immediate',
    consistency: 'strong',
    fanOut: 1,
    replay: 'not-required',
    purpose: 'business-request'
  });

  assert.equal(result.selected.patternId, 'pattern.sync-api');
  assert.equal(result.selected.fit, 'preferred');
  const async = result.alternatives.find((item) => item.patternId === 'pattern.async-message');
  assert.equal(async.fit, 'disfavored');
  assert.ok(async.tradeoffs.some((text) => text.includes('final downstream business result')));
});

test('high-volume replayable point-to-point transfer prefers asynchronous message', () => {
  const result = decideIntegrationPattern({
    latency: 'seconds',
    consistency: 'eventual',
    volume: 'high',
    fanOut: 1,
    replay: 'required',
    ordering: 'per-key',
    offlineTolerance: 'short',
    purpose: 'state-transfer'
  });

  assert.equal(result.selected.patternId, 'pattern.async-message');
  assert.ok(result.selected.because.some((text) => text.includes('replay')));
});

test('business fact with multiple consumers prefers domain event', () => {
  const result = decideIntegrationPattern({
    latency: 'seconds',
    consistency: 'eventual',
    fanOut: 3,
    replay: 'required',
    changeFrequency: 'high',
    purpose: 'business-event'
  });

  assert.equal(result.selected.patternId, 'pattern.domain-event');
  assert.ok(result.selected.because.some((text) => text.includes('multiple independently evolving consumers')));
});

test('partner document exchange prefers EDI/B2B and rejects CDC', () => {
  const evaluations = evaluateIntegrationPatterns({
    partnerBoundary: true,
    purpose: 'partner-document',
    latency: 'minutes',
    consistency: 'eventual'
  });

  assert.equal(evaluations[0].patternId, 'pattern.edi-b2b');
  assert.equal(evaluations.find((item) => item.patternId === 'pattern.cdc').fit, 'incompatible');
});

test('analytics path prefers ETL/ELT', () => {
  const result = decideIntegrationPattern({ purpose: 'analytics', latency: 'minutes', payloadSize: 'large' });
  assert.equal(result.selected.patternId, 'pattern.etl-elt');
});

test('high-volume analytics still selects ETL/ELT when asynchronous messaging is also viable', () => {
  const result = decideIntegrationPattern({
    purpose: 'analytics',
    latency: 'minutes',
    payloadSize: 'large',
    volume: 'high',
    replay: 'desirable',
    fanOut: 1
  });

  assert.equal(result.selected.patternId, 'pattern.etl-elt');
  const async = result.alternatives.find((item) => item.patternId === 'pattern.async-message');
  assert.equal(async.fit, 'preferred');
});

test('conflicting architecture drivers surface questions instead of being hidden', () => {
  const result = decideIntegrationPattern({
    immediateResponse: true,
    latency: 'immediate',
    consistency: 'strong',
    offlineTolerance: 'extended',
    partnerBoundary: true,
    fanOut: 2
  });

  assert.ok(result.conflicts.length >= 2);
  assert.ok(result.conflicts.some((item) => item.id === 'conflict.immediate-vs-offline'));
  assert.ok(result.conflicts.some((item) => item.id === 'conflict.partner-vs-strong-consistency'));
});

test('normalization is explicit and deterministic', () => {
  assert.deepEqual(
    normalizeIntegrationDrivers({ immediateResponse: true, volume: 'nonsense' }),
    normalizeIntegrationDrivers({ immediateResponse: true, volume: 'nonsense' })
  );
});

test('selected patterns map to Interface-as-Code-compatible transport semantics', () => {
  assert.deepEqual(patternToInterfaceSemantics('pattern.sync-api'), {
    mode: 'sync',
    pattern: 'request-response',
    suggestedFormats: ['REST', 'OData', 'SOAP']
  });
  assert.equal(patternToInterfaceSemantics('pattern.batch-file').mode, 'batch');
});
