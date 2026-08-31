import { composeArchitecture as composeBase } from './engine.mjs';
import { decideIntegrationPattern } from './integration-decision.mjs';
import { analyzeArchitectureQuality } from './quality.mjs';
import { buildTransitionArchitecture } from './transition.mjs';

const EXPLICIT_NFR_KEYS = ['latency', 'consistency', 'volume', 'replay', 'ordering', 'offlineTolerance'];

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

function explicitProfile(integrationId, input) {
  return { ...(input?.nfrProfile ?? {}), ...(input?.integrationProfiles?.[integrationId] ?? {}) };
}

function missingExplicitNfrs(integrationId, input) {
  const explicit = explicitProfile(integrationId, input);
  return EXPLICIT_NFR_KEYS.filter((key) => explicit[key] === undefined);
}

function sortedUnique(values = []) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function uniqueById(items = []) {
  return [...new Map(items.map((item) => [item.id, item])).values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function composeArchitecture(input = {}) {
  const result = composeBase(input);
  const profileEntries = [];
  const extraFindings = [];

  const integrations = result.blueprint.integrations.map((integration) => {
    const requestedProfile = mergeProfile(integration, result, input);
    const decision = decideIntegrationPattern(requestedProfile);
    const perFlowProfile = input?.integrationProfiles?.[integration.id] ?? null;
    if (perFlowProfile) profileEntries.push([integration.id, structuredClone(perFlowProfile)]);

    if (input.requireExplicitNfrs) {
      const missing = missingExplicitNfrs(integration.id, input);
      if (missing.length) {
        extraFindings.push({
          id: `finding.nfr-explicit.${integration.id.replace('integration.', '')}`,
          severity: 'warning',
          kind: 'nfr-decision',
          ruleIds: ['NFR-EXPLICIT-001'],
          objectIds: [integration.id],
          message: `${integration.name} still relies on catalog defaults for: ${missing.join(', ')}.`,
          nextDecision: `Confirm explicit ${missing.join(', ')} requirements for ${integration.id} or disable strict NFR confirmation for this scenario.`
        });
      }
    }

    if (decision.selected && decision.selected.patternId !== integration.patternId && perFlowProfile) {
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
        explicitDrivers: explicitProfile(integration.id, input),
        missingExplicitDrivers: input.requireExplicitNfrs ? missingExplicitNfrs(integration.id, input) : [],
        recommendedPatternId: decision.selected?.patternId ?? null,
        recommendedFit: decision.selected?.fit ?? null,
        selectedMatchesBlueprint: decision.selected?.patternId === integration.patternId,
        decisiveBecause: decision.selected?.because ?? [],
        decisiveTradeoffs: decision.selected?.tradeoffs ?? [],
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
      nfrAnalysis: {
        drivers: integration.decisionAnalysis.drivers,
        explicitDrivers: integration.decisionAnalysis.explicitDrivers,
        decisiveBecause: integration.decisionAnalysis.decisiveBecause,
        decisiveTradeoffs: integration.decisionAnalysis.decisiveTradeoffs,
        missingExplicitDrivers: integration.decisionAnalysis.missingExplicitDrivers,
        recommendedPatternId: integration.decisionAnalysis.recommendedPatternId
      },
      alternativeAnalysis: integration.decisionAnalysis.alternatives
    };
  });

  const integrationProfiles = Object.fromEntries(profileEntries.sort(([a], [b]) => a.localeCompare(b)));
  const context = {
    ...result.context,
    ...(input.nfrProfile ? { nfrProfile: structuredClone(input.nfrProfile) } : {}),
    ...(input.requireExplicitNfrs ? { requireExplicitNfrs: true } : {}),
    ...(Object.keys(integrationProfiles).length ? { integrationProfiles } : {}),
    ...(input.currentLandscape ? { currentLandscape: structuredClone(input.currentLandscape) } : {})
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
  const transition = buildTransitionArchitecture(draft, input.currentLandscape ?? null);
  const findings = uniqueById([
    ...draft.findings,
    ...quality.findings,
    ...(transition?.findings ?? [])
  ]);

  const decisionFindingIds = findings
    .filter((item) => item.severity !== 'info')
    .map((item) => item.id);
  const baseWorkPackages = result.workPackages.map((item) => item.id === 'wp.architecture.resolve-decisions'
    ? { ...item, sourceIds: sortedUnique([...(item.sourceIds ?? []), ...decisionFindingIds]) }
    : item);
  const workPackages = uniqueById([...baseWorkPackages, ...(transition?.workPackages ?? [])]);

  return {
    ...draft,
    findings,
    workPackages,
    ...(transition ? { transition: { ...transition, findings: undefined, workPackages: undefined } } : {}),
    metrics: {
      ...result.metrics,
      findingCount: findings.length,
      workPackageCount: workPackages.length,
      explicitNfrGapCount: findings.filter((item) => item.kind === 'nfr-decision').length,
      ...quality.metrics,
      ...(transition ? {
        transitionSystemCount: transition.systems.length,
        transitionIntegrationCount: transition.integrations.length,
        replacementCount: transition.replacements.length,
        coexistenceWindowCount: transition.coexistenceWindows.length
      } : {})
    }
  };
}

export function serializeComposition(result) {
  return `${JSON.stringify(result, null, 2)}\n`;
}
