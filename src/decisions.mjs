const DECISION_STATUSES = new Set(['accepted', 'rejected', 'overridden']);

function stableId(recommendationId) {
  return `decision.${String(recommendationId).replace(/^rec\./, '')}`;
}

function snapshotRecommendation(recommendation) {
  if (!recommendation) return null;
  return {
    id: recommendation.id,
    kind: recommendation.kind,
    decision: recommendation.decision,
    confidence: recommendation.confidence,
    because: [...(recommendation.because ?? [])],
    ruleIds: [...(recommendation.ruleIds ?? [])].sort(),
    alternatives: [...(recommendation.alternatives ?? [])].sort()
  };
}

function normalizeInput(record) {
  if (!record?.recommendationId) throw new Error('architectureDecisions[].recommendationId is required');
  if (!DECISION_STATUSES.has(record.status)) {
    throw new Error(`Invalid architecture decision status for ${record.recommendationId}: ${record.status}`);
  }
  if (['rejected', 'overridden'].includes(record.status) && !String(record.rationale ?? '').trim()) {
    throw new Error(`${record.status} architecture decision ${record.recommendationId} requires rationale`);
  }
  if (record.status === 'overridden' && !String(record.selectedDecision ?? '').trim()) {
    throw new Error(`overridden architecture decision ${record.recommendationId} requires selectedDecision`);
  }
  return {
    id: record.id ?? stableId(record.recommendationId),
    recommendationId: record.recommendationId,
    status: record.status,
    ...(record.selectedDecision !== undefined ? { selectedDecision: String(record.selectedDecision) } : {}),
    ...(record.rationale !== undefined ? { rationale: String(record.rationale) } : {}),
    ...(record.sourceRecommendation ? { sourceRecommendation: structuredClone(record.sourceRecommendation) } : {})
  };
}

export function validateArchitectureDecisions(records = []) {
  const errors = [];
  const ids = new Set();
  const recommendations = new Set();

  for (const raw of records) {
    try {
      const record = normalizeInput(raw);
      if (ids.has(record.id)) errors.push(`Duplicate architecture decision ID: ${record.id}`);
      if (recommendations.has(record.recommendationId)) errors.push(`Multiple architecture decisions target ${record.recommendationId}`);
      ids.add(record.id);
      recommendations.add(record.recommendationId);
    } catch (error) {
      errors.push(error.message);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function applyArchitectureDecisions(result, records = []) {
  const validation = validateArchitectureDecisions(records);
  if (!validation.valid) throw new Error(`Invalid architecture decisions:\n- ${validation.errors.join('\n- ')}`);

  const recommendationIndex = new Map(result.recommendations.map((item) => [item.id, item]));
  const normalized = records.map(normalizeInput).sort((a, b) => a.id.localeCompare(b.id));
  const findings = [];
  const decisionRecords = normalized.map((record) => {
    const current = recommendationIndex.get(record.recommendationId) ?? null;
    const original = record.sourceRecommendation ?? snapshotRecommendation(current);
    const applies = Boolean(current);

    if (!applies) {
      findings.push({
        id: `decision.orphaned.${record.id.replace(/^decision\./, '')}`,
        severity: 'warning',
        kind: 'decision-drift',
        ruleIds: ['DECISION-ORPHAN-001'],
        objectIds: [record.id, record.recommendationId],
        message: `Human decision ${record.id} targets a recommendation that is no longer produced by the current architecture context.`,
        nextDecision: 'Review whether the prior human decision should be retired, remapped to a new recommendation, or the architecture context should be restored.'
      });
    }

    const effectiveDecision = !applies
      ? null
      : record.status === 'accepted'
        ? current.decision
        : record.status === 'overridden'
          ? record.selectedDecision
          : null;

    return {
      ...record,
      applies,
      effectiveDecision,
      sourceRecommendation: original,
      currentRecommendation: snapshotRecommendation(current)
    };
  });

  const recordByRecommendation = new Map(decisionRecords.map((item) => [item.recommendationId, item]));
  const recommendations = result.recommendations.map((recommendation) => {
    const record = recordByRecommendation.get(recommendation.id);
    if (!record) return recommendation;
    return {
      ...recommendation,
      humanDecision: {
        recordId: record.id,
        status: record.status,
        applies: record.applies,
        effectiveDecision: record.effectiveDecision,
        rationale: record.rationale ?? null
      }
    };
  });

  const integrationDecisionMap = new Map();
  for (const record of decisionRecords) {
    if (!record.recommendationId.startsWith('rec.integration.')) continue;
    const integrationId = record.recommendationId.replace(/^rec\./, '');
    integrationDecisionMap.set(integrationId, record);
  }

  return {
    records: decisionRecords,
    recommendations,
    findings: findings.sort((a, b) => a.id.localeCompare(b.id)),
    integrationDecisionMap
  };
}

export function architectureDecisionInput(records = []) {
  return records.map((record) => ({
    id: record.id,
    recommendationId: record.recommendationId,
    status: record.status,
    ...(record.selectedDecision !== undefined ? { selectedDecision: record.selectedDecision } : {}),
    ...(record.rationale !== undefined ? { rationale: record.rationale } : {}),
    ...(record.sourceRecommendation ? { sourceRecommendation: structuredClone(record.sourceRecommendation) } : {})
  })).sort((a, b) => a.id.localeCompare(b.id));
}
