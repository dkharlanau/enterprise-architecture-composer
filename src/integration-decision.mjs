const FIT_ORDER = { preferred: 0, acceptable: 1, disfavored: 2, incompatible: 3 };

export const INTEGRATION_PATTERN_IDS = [
  'pattern.sync-api',
  'pattern.async-message',
  'pattern.domain-event',
  'pattern.edi-b2b',
  'pattern.batch-file',
  'pattern.cdc',
  'pattern.etl-elt'
];

const LABELS = {
  'pattern.sync-api': 'Synchronous API',
  'pattern.async-message': 'Asynchronous Message',
  'pattern.domain-event': 'Domain Event',
  'pattern.edi-b2b': 'EDI / B2B Exchange',
  'pattern.batch-file': 'File / Batch',
  'pattern.cdc': 'CDC / Replication',
  'pattern.etl-elt': 'ETL / ELT'
};

function enumValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function normalizeIntegrationDrivers(input = {}) {
  const immediateResponse = Boolean(input.immediateResponse);
  const partnerBoundary = Boolean(input.partnerBoundary);
  const purpose = String(input.purpose ?? 'state-transfer');

  return {
    purpose,
    latency: enumValue(input.latency, ['immediate', 'seconds', 'minutes', 'hours'], immediateResponse ? 'immediate' : 'seconds'),
    consistency: enumValue(input.consistency, ['strong', 'eventual', 'snapshot'], immediateResponse ? 'strong' : 'eventual'),
    volume: enumValue(input.volume, ['low', 'medium', 'high', 'very-high'], 'medium'),
    fanOut: Number.isInteger(input.fanOut) && input.fanOut > 0 ? input.fanOut : 1,
    ordering: enumValue(input.ordering, ['none', 'per-key', 'global'], 'none'),
    replay: enumValue(input.replay, ['not-required', 'desirable', 'required'], immediateResponse ? 'not-required' : 'desirable'),
    offlineTolerance: enumValue(input.offlineTolerance, ['none', 'short', 'extended'], 'short'),
    partnerBoundary,
    payloadSize: enumValue(input.payloadSize, ['small', 'medium', 'large', 'very-large'], 'medium'),
    changeFrequency: enumValue(input.changeFrequency, ['low', 'medium', 'high'], 'medium'),
    immediateResponse
  };
}

function evaluation(patternId, fit, because = [], tradeoffs = [], ruleIds = []) {
  return { patternId, label: LABELS[patternId], fit, because, tradeoffs, ruleIds };
}

function evaluateSyncApi(d) {
  const incompatible = [];
  const positive = [];
  const tradeoffs = [];

  if (d.partnerBoundary && d.offlineTolerance === 'extended') incompatible.push('extended partner outage tolerance conflicts with synchronous availability coupling');
  if (d.payloadSize === 'very-large') incompatible.push('very large payloads are a poor fit for request/response transport');
  if (d.latency === 'immediate') positive.push('the caller needs an immediate business response');
  if (d.consistency === 'strong') positive.push('the interaction requires strong transactional feedback');
  if (d.fanOut > 1) tradeoffs.push('multiple consumers would couple the caller to orchestration or repeated calls');
  if (d.replay === 'required') tradeoffs.push('replay is not naturally represented by a synchronous request/response contract');
  if (['high', 'very-high'].includes(d.volume)) tradeoffs.push('high volume increases synchronous capacity and availability coupling');

  if (incompatible.length) return evaluation('pattern.sync-api', 'incompatible', incompatible, tradeoffs, ['INT-SYNC-001']);
  if (d.latency === 'immediate' && d.fanOut === 1) return evaluation('pattern.sync-api', 'preferred', positive, tradeoffs, ['INT-SYNC-001']);
  if (d.latency === 'immediate') return evaluation('pattern.sync-api', 'acceptable', positive, tradeoffs, ['INT-SYNC-001']);
  return evaluation('pattern.sync-api', tradeoffs.length >= 2 ? 'disfavored' : 'acceptable', positive, tradeoffs, ['INT-SYNC-001']);
}

function evaluateAsyncMessage(d) {
  const positive = [];
  const tradeoffs = [];
  if (d.latency === 'immediate' && d.consistency === 'strong') tradeoffs.push('the caller cannot receive the final downstream business result in the same interaction');
  if (d.fanOut === 1) positive.push('there is one principal downstream responsibility');
  if (d.replay !== 'not-required') positive.push('the flow benefits from durable delivery and replay');
  if (['high', 'very-high'].includes(d.volume)) positive.push('decoupling absorbs high-volume bursts');
  if (d.ordering === 'per-key') positive.push('per-key ordering can be handled explicitly');
  if (d.offlineTolerance !== 'none') positive.push('producer and consumer do not need to be available at the same time');
  if (d.fanOut > 1) tradeoffs.push('multiple independent consumers may be better represented as a published business event');

  if (d.latency === 'immediate' && d.consistency === 'strong') return evaluation('pattern.async-message', 'disfavored', positive, tradeoffs, ['INT-ASYNC-001']);
  if (d.fanOut === 1 && (d.replay === 'required' || ['high', 'very-high'].includes(d.volume))) return evaluation('pattern.async-message', 'preferred', positive, tradeoffs, ['INT-ASYNC-002']);
  return evaluation('pattern.async-message', 'acceptable', positive, tradeoffs, ['INT-ASYNC-001']);
}

function evaluateDomainEvent(d) {
  const positive = [];
  const tradeoffs = [];
  if (d.immediateResponse && d.consistency === 'strong') tradeoffs.push('a domain event cannot provide the initiating caller with a synchronous final business result');
  if (d.fanOut >= 2) positive.push('multiple independently evolving consumers need the same business fact');
  if (d.purpose === 'business-event') positive.push('the semantic is a business fact rather than a point-to-point command');
  if (d.replay !== 'not-required') positive.push('retained events can support replay and new consumers');
  if (d.changeFrequency === 'high') positive.push('producer and consumers can evolve with lower direct coupling');
  if (d.fanOut === 1) tradeoffs.push('with one known consumer, event publication may add unnecessary indirection');

  if (d.immediateResponse && d.consistency === 'strong') return evaluation('pattern.domain-event', 'disfavored', positive, tradeoffs, ['INT-EVENT-001']);
  if (d.fanOut >= 2 && d.purpose === 'business-event') return evaluation('pattern.domain-event', 'preferred', positive, tradeoffs, ['INT-EVENT-001']);
  return evaluation('pattern.domain-event', d.fanOut >= 2 ? 'acceptable' : 'disfavored', positive, tradeoffs, ['INT-EVENT-001']);
}

function evaluateB2B(d) {
  const positive = [];
  const tradeoffs = [];
  if (d.partnerBoundary) positive.push('the flow crosses an external trading-partner boundary');
  if (d.purpose === 'partner-document') positive.push('the payload is a structured business document exchanged with a partner');
  if (!d.partnerBoundary) tradeoffs.push('there is no external trading-partner boundary');
  if (d.latency === 'immediate') tradeoffs.push('traditional partner document exchange is not optimized for immediate transactional response');

  if (!d.partnerBoundary) return evaluation('pattern.edi-b2b', 'incompatible', positive, tradeoffs, ['INT-B2B-001']);
  if (d.purpose === 'partner-document') return evaluation('pattern.edi-b2b', 'preferred', positive, tradeoffs, ['INT-B2B-001']);
  return evaluation('pattern.edi-b2b', 'acceptable', positive, tradeoffs, ['INT-B2B-001']);
}

function evaluateBatch(d) {
  const positive = [];
  const tradeoffs = [];
  if (['minutes', 'hours'].includes(d.latency)) positive.push('the business tolerates delayed scheduled exchange');
  if (['large', 'very-large'].includes(d.payloadSize)) positive.push('bulk payload transfer is acceptable');
  if (d.offlineTolerance === 'extended') positive.push('extended endpoint unavailability can be tolerated');
  if (d.latency === 'immediate') tradeoffs.push('batch cannot satisfy an immediate response requirement');
  if (d.consistency === 'strong') tradeoffs.push('snapshot transfer weakens transactional consistency');
  if (d.changeFrequency === 'high') tradeoffs.push('frequent change may make repeated bulk snapshots inefficient');

  if (d.latency === 'immediate') return evaluation('pattern.batch-file', 'incompatible', positive, tradeoffs, ['INT-BATCH-001']);
  if (d.latency === 'hours' || d.payloadSize === 'very-large') return evaluation('pattern.batch-file', 'preferred', positive, tradeoffs, ['INT-BATCH-001']);
  return evaluation('pattern.batch-file', tradeoffs.length >= 2 ? 'disfavored' : 'acceptable', positive, tradeoffs, ['INT-BATCH-001']);
}

function evaluateCdc(d) {
  const positive = [];
  const tradeoffs = [];
  if (d.purpose === 'replication') positive.push('the intent is to propagate source-state changes to another persistence/read model');
  if (['high', 'very-high'].includes(d.volume)) positive.push('incremental change propagation avoids repeated full snapshots');
  if (d.latency === 'seconds') positive.push('near-real-time propagation is required without request/response semantics');
  if (d.purpose !== 'replication') tradeoffs.push('the business semantic is not primarily state replication');
  if (d.partnerBoundary) tradeoffs.push('database/change-log replication is a poor abstraction across an external partner boundary');

  if (d.partnerBoundary) return evaluation('pattern.cdc', 'incompatible', positive, tradeoffs, ['INT-CDC-001']);
  if (d.purpose === 'replication') return evaluation('pattern.cdc', 'preferred', positive, tradeoffs, ['INT-CDC-001']);
  return evaluation('pattern.cdc', 'disfavored', positive, tradeoffs, ['INT-CDC-001']);
}

function evaluateEtl(d) {
  const positive = [];
  const tradeoffs = [];
  if (d.purpose === 'analytics') positive.push('the target consumes data for analytical rather than transactional processing');
  if (['large', 'very-large'].includes(d.payloadSize)) positive.push('bulk analytical movement and transformation is acceptable');
  if (d.latency === 'immediate') tradeoffs.push('analytical ETL/ELT is not a transactional request/response mechanism');
  if (d.consistency === 'strong') tradeoffs.push('analytical pipelines generally operate with delayed consistency');
  if (d.purpose !== 'analytics') tradeoffs.push('the target is not an analytical consumption path');

  if (d.purpose === 'analytics') return evaluation('pattern.etl-elt', 'preferred', positive, tradeoffs, ['INT-ANALYTICS-001']);
  return evaluation('pattern.etl-elt', d.latency === 'immediate' ? 'incompatible' : 'disfavored', positive, tradeoffs, ['INT-ANALYTICS-001']);
}

export function evaluateIntegrationPatterns(input = {}) {
  const drivers = normalizeIntegrationDrivers(input);
  return [
    evaluateSyncApi(drivers),
    evaluateAsyncMessage(drivers),
    evaluateDomainEvent(drivers),
    evaluateB2B(drivers),
    evaluateBatch(drivers),
    evaluateCdc(drivers),
    evaluateEtl(drivers)
  ].sort((a, b) => FIT_ORDER[a.fit] - FIT_ORDER[b.fit] || a.patternId.localeCompare(b.patternId));
}

function conflictDiagnostics(drivers) {
  const conflicts = [];
  if (drivers.latency === 'immediate' && drivers.offlineTolerance === 'extended') {
    conflicts.push({
      id: 'conflict.immediate-vs-offline',
      message: 'Immediate response and extended offline tolerance pull the design in opposite directions.',
      nextDecision: 'Clarify whether immediate acknowledgement is enough, or whether the final business result must be immediate.'
    });
  }
  if (drivers.consistency === 'strong' && drivers.fanOut >= 2) {
    conflicts.push({
      id: 'conflict.strong-consistency-vs-fanout',
      message: 'Strong cross-system consistency with multiple independent consumers creates coordination coupling.',
      nextDecision: 'Separate the synchronous source transaction from downstream eventual-consistency consumers where possible.'
    });
  }
  if (drivers.partnerBoundary && drivers.consistency === 'strong') {
    conflicts.push({
      id: 'conflict.partner-vs-strong-consistency',
      message: 'An external partner boundary cannot safely be assumed to participate in one strongly consistent transaction.',
      nextDecision: 'Define acknowledgement, business acceptance and reconciliation as separate semantics.'
    });
  }
  return conflicts;
}

function semanticPriority(drivers) {
  if (drivers.purpose === 'analytics') return ['pattern.etl-elt', 'pattern.cdc', 'pattern.batch-file', 'pattern.async-message'];
  if (drivers.purpose === 'partner-document' || drivers.partnerBoundary) return ['pattern.edi-b2b', 'pattern.async-message', 'pattern.batch-file'];
  if (drivers.purpose === 'replication') return ['pattern.cdc', 'pattern.domain-event', 'pattern.async-message', 'pattern.batch-file'];
  if (drivers.purpose === 'business-event' && drivers.fanOut >= 2) return ['pattern.domain-event', 'pattern.async-message'];
  if (drivers.immediateResponse || drivers.latency === 'immediate') return ['pattern.sync-api', 'pattern.async-message'];
  if (drivers.purpose === 'command' || drivers.purpose === 'state-transfer') return ['pattern.async-message', 'pattern.sync-api', 'pattern.batch-file'];
  return INTEGRATION_PATTERN_IDS;
}

function selectEvaluation(evaluations, drivers) {
  const viable = evaluations.filter((item) => ['preferred', 'acceptable'].includes(item.fit));
  if (!viable.length) return null;
  const priority = semanticPriority(drivers);
  return [...viable].sort((a, b) => {
    const fit = FIT_ORDER[a.fit] - FIT_ORDER[b.fit];
    if (fit) return fit;
    const ai = priority.indexOf(a.patternId);
    const bi = priority.indexOf(b.patternId);
    const ar = ai < 0 ? 999 : ai;
    const br = bi < 0 ? 999 : bi;
    return ar - br || a.patternId.localeCompare(b.patternId);
  })[0];
}

export function decideIntegrationPattern(input = {}) {
  const drivers = normalizeIntegrationDrivers(input);
  const evaluations = evaluateIntegrationPatterns(drivers);
  const conflicts = conflictDiagnostics(drivers);
  const selected = selectEvaluation(evaluations, drivers);
  return {
    drivers,
    selected,
    conflicts,
    alternatives: evaluations.filter((item) => item.patternId !== selected?.patternId)
  };
}

export function patternToInterfaceSemantics(patternId) {
  const map = {
    'pattern.sync-api': { mode: 'sync', pattern: 'request-response', suggestedFormats: ['REST', 'OData', 'SOAP'] },
    'pattern.async-message': { mode: 'async', pattern: 'message-driven', suggestedFormats: ['JMS', 'Kafka', 'JSON', 'XML'] },
    'pattern.domain-event': { mode: 'async', pattern: 'event-driven', suggestedFormats: ['Kafka', 'JSON'] },
    'pattern.edi-b2b': { mode: 'async', pattern: 'message-driven', suggestedFormats: ['EDI', 'XML'] },
    'pattern.batch-file': { mode: 'batch', pattern: 'scheduled-batch', suggestedFormats: ['File', 'CSV', 'XML'] },
    'pattern.cdc': { mode: 'async', pattern: 'event-driven', suggestedFormats: ['Kafka', 'JSON'] },
    'pattern.etl-elt': { mode: 'batch', pattern: 'scheduled-batch', suggestedFormats: ['File', 'CSV', 'JSON'] }
  };
  return map[patternId] ?? null;
}
