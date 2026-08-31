import { composeArchitecture as composeBase } from './engine.mjs';
import { decideIntegrationPattern } from './integration-decision.mjs';
import { analyzeArchitectureQuality } from './quality.mjs';

function defaultPurpose(integration) {
  const map = {
    'pattern.sync-api': 'business-request',
    'pattern.async-message': 'state-transfer',
    'pattern.domain-event': 'business-event',
    'pattern.edi-b2b': 'partner-document',
    'pattern.batch-file': 'state-transfer',
    'pattern.cdc': 'replication',
    'pattern.etl-elt': 'analytics'
  };
  return map[integration.patternId] ?? 'state-transfer';
}

function defaultProfile(integration, result) {
  return {
    purpose: defaultPurpose(integration),
    immediateResponse: integration.patternId === 'pattern.sync-api',
    latency: integration.patternId === 'pattern.sync-api' ? 'immediate' : integration.patternId === 'pattern.etl-elt' ? 'minutes' : 'seconds',
    consistency: integration.patternId === 'pattern.sync-api' ? 'strong' : integration.patternId === 'pattern.etl-elt' ? 'snapshot' : 'eventual',
    volume: result.context.constraints.highVolume ? 'high' : 'medium',
    fanOut: integration.patternId === 'pattern.domain-event' ? 2 : 1,
    ordering: 'none',
    replay: integration.mode === 'async' ? 'desirable' : 'not-required',
    offlineTolerance: integration.partnerBoundary ? 'extended' : integration.mode === 'async' ? 'short' : 'none',
    partnerBoundary: integration.partnerBoundary,
    payloadSize: integration.patternId === 'pattern.etl-elt' ? 'large' : 'medium',
    changeFrequency: 'medium'
  };
}

function mergeProfile(integration, result, input) {
  const global = input?.nfrProfile ?? {};
  const perFlow = input?.integrationProfiles?.[integration.id] ?? {};
  return { ...defaultProfile(integration, result), ...global, ...perFlow };
}

function sortedUnique(values = []) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function composeArchitecture(input = {}) {
  const result = composeBase(input);
  const profileEntries = [];
  const extraFindings = [];

  const integrations = result.blueprint.integrations.map((integration) => {
    const requestedProfile = mergeProfile(integration, result, input);
    const decision = decideIntegrationPattern(requestedProfile);
    const explicitProfile = input?.integrationProfiles?.[integration.id] ?? null;
    if (explicitProfile) profileEntries.push([integration.id, structuredClone(explicitProfile)]);

    if (decision.selected && decision.selected.patternId !== integration.patternId && explicitProfile) {
      extraFindings.push({
        id: `finding.integration-profile.${integration.id.replace('integration.', '')}`,
        severity: 'warning',
        kind: 'integration-decision',
        ruleIds: decision.selected.ruleIds,
        objectIds: [integration.id],
        message: `Explicit NFR drivers favor ${decision.selected.label} instead of the catalog-default ${integration.patternName}.`,
        nextDecision: `Confirm whether ${integration.id} should change to ${decision.selected.label} or whether the NFR profile needs refinement.`
      });
    }

    for (const conflict of decision.conflicts) {
      extraFindings.push({
        id: `finding.${integration.id.replace('integration.', '')}.${conflict.id}`,
        severity: 'warning',
        kind: 'integration-driver-conflict',
        ruleIds: ['INT-NFR-CONFLICT-001'],
        objectIds: [integration.id],
        message: conflict.message,
        nextDecision: conflict.nextDecision
      });
    }

    return {
      ...integration,
      decisionAnalysis: {
        drivers: decision.drivers,
        recommendedPatternId: decision.selected?.patternId ?? null,
        recommendedFit: decision.selected?.fit ?? null,
        selectedMatchesBlueprint: decision.selected?.patternId === integration.patternId,
        alternatives: decision.alternatives
      }
    };
  });

  const recommendations = result.recommendations.map((recommendation) => {
    if (recommendation.kind !== 'integration-pattern') return recommendation;
    const integrationId = recommendation.id.replace(/^rec\./, '');
    const integration = integrations.find((item) => item.id === integrationId);
    if (!integration) return recommendation;
    return {
      ...recommendation,
      alternativeAnalysis: integration.decisionAnalysis.alternatives
    };
  });

  const integrationProfiles = Object.fromEntries(profileEntries.sort(([a], [b]) => a.localeCompare(b)));
  const context = {
    ...result.context,
    ...(input.nfrProfile ? { nfrProfile: structuredClone(input.nfrProfile) } : {}),
    ...(Object.keys(integrationProfiles).length ? { integrationProfiles } : {})
  };

  const draft = {
    ...result,
    engineVersion: '0.2.0',
    context,
    blueprint: { ...result.blueprint, integrations },
    recommendations,
    findings: [...result.findings, ...extraFindings].sort((a, b) => a.id.localeCompare(b.id))
  };

  const quality = analyzeArchitectureQuality(draft);
  const findings = [...new Map([...draft.findings, ...quality.findings].map((item) => [item.id, item])).values()]
    .sort((a, b) => a.id.localeCompare(b.id));

  const decisionFindingIds = findings
    .filter((item) => item.severity !== 'info')
    .map((item) => item.id);
  const workPackages = result.workPackages.map((item) => item.id === 'wp.architecture.resolve-decisions'
    ? { ...item, sourceIds: sortedUnique([...(item.sourceIds ?? []), ...decisionFindingIds]) }
    : item);

  return {
    ...draft,
    findings,
    workPackages,
    metrics: {
      ...result.metrics,
      findingCount: findings.length,
      ...quality.metrics
    }
  };
}

export function serializeComposition(result) {
  return `${JSON.stringify(result, null, 2)}\n`;
}
