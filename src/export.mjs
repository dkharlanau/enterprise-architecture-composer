import { composeArchitecture, serializeComposition } from './composer.mjs';
import { buildDeliveryRoadmap, roadmapToMarkdown } from './roadmap.mjs';

const SAFE_CONTEXT_KEYS = ['industry', 'operatingModel', 'processes', 'scale', 'constraints', 'existingSystemIds', 'nfrProfile', 'integrationProfiles'];

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
}

export function createShareableContext(context) {
  const clean = {};
  for (const key of SAFE_CONTEXT_KEYS) {
    if (context[key] !== undefined) clean[key] = structuredClone(context[key]);
  }
  return stableObject(clean);
}

export function createPortableBundle(result, options = {}) {
  const shareable = options.shareable !== false;
  const context = shareable ? createShareableContext(result.context) : structuredClone(result.context);
  const roadmap = buildDeliveryRoadmap(result);

  return stableObject({
    format: 'enterprise-architecture-composer/bundle',
    formatVersion: '0.1',
    source: {
      engineVersion: result.engineVersion,
      catalogVersion: result.catalogVersion,
      blueprintSchemaVersion: result.schemaVersion
    },
    context,
    blueprint: result,
    roadmap,
    privacy: {
      shareable,
      policy: shareable ? 'known-composer-context-fields-only' : 'full-context'
    }
  });
}

export function restoreContextFromBundle(bundle) {
  if (bundle?.format !== 'enterprise-architecture-composer/bundle') throw new Error('Not an Enterprise Architecture Composer bundle.');
  if (bundle?.formatVersion !== '0.1') throw new Error(`Unsupported bundle version: ${bundle?.formatVersion ?? 'unknown'}`);

  const stored = structuredClone(bundle.context);
  return {
    industry: stored.industry,
    operatingModel: stored.operatingModel,
    processes: stored.processes,
    scale: stored.scale,
    constraints: stored.constraints,
    existingSystems: stored.existingSystemIds ?? [],
    ...(stored.nfrProfile ? { nfrProfile: stored.nfrProfile } : {}),
    ...(stored.integrationProfiles ? { integrationProfiles: stored.integrationProfiles } : {})
  };
}

export function verifyBundleRecomposition(bundle) {
  const context = restoreContextFromBundle(bundle);
  const recomposed = composeArchitecture(context);
  return {
    matches: serializeComposition(recomposed) === serializeComposition(bundle.blueprint),
    recomposed
  };
}

export function bundleToMarkdown(bundle) {
  const result = bundle.blueprint;
  const roadmap = bundle.roadmap;
  const lines = [
    '# Enterprise Architecture Decision Report',
    '',
    `Engine: ${result.engineVersion} · Catalog: ${result.catalogVersion} · Bundle: ${bundle.formatVersion}`,
    '',
    '## Context',
    '',
    `- Industry: ${result.context.industry}`,
    `- Operating model: ${result.context.operatingModel}`,
    `- Processes: ${result.context.processes.join(', ')}`,
    `- Countries: ${result.context.scale.countries}`,
    `- Legal entities: ${result.context.scale.legalEntities}`,
    `- Plants: ${result.context.scale.plants}`,
    `- Warehouses: ${result.context.scale.warehouses}`,
    `- Existing systems: ${result.context.existingSystemIds.length ? result.context.existingSystemIds.join(', ') : 'none declared'}`,
    '',
    '## Target architecture',
    '',
    `- ${result.metrics.processCount} processes`,
    `- ${result.metrics.capabilityCount} capabilities`,
    `- ${result.metrics.systemCount} system responsibilities`,
    `- ${result.metrics.integrationCount} integration flows`,
    `- ${result.metrics.asyncIntegrationCount} asynchronous flows`,
    '',
    '### System responsibilities',
    ''
  ];

  for (const system of result.blueprint.systems) {
    lines.push(`- **${system.name}** (\`${system.id}\`) — ${system.intent}; reasons: ${(system.reasonIds ?? []).join(', ') || 'direct scope'}`);
  }

  lines.push('', '### Integrations', '');
  for (const integration of result.blueprint.integrations) {
    const nfrDecision = integration.decisionAnalysis;
    lines.push(`- **${integration.name}** — ${integration.patternName}; \`${integration.source}\` → \`${integration.target}\`; rules: ${integration.ruleIds.join(', ')}`);
    if (nfrDecision && !nfrDecision.selectedMatchesBlueprint) {
      lines.push(`  - NFR review: ${nfrDecision.recommendedPatternId} is currently preferred by the explicit driver profile.`);
    }
  }

  lines.push('', '## Architecture findings', '');
  if (!result.findings.length) lines.push('No open architecture findings in this composition.');
  for (const finding of result.findings) {
    lines.push(`### ${finding.message}`);
    lines.push('');
    lines.push(`- Severity: ${finding.severity}`);
    lines.push(`- Rule(s): ${finding.ruleIds.join(', ')}`);
    lines.push(`- Objects: ${finding.objectIds.join(', ')}`);
    lines.push(`- Next decision: ${finding.nextDecision}`);
    lines.push('');
  }

  lines.push('## Recommendations', '');
  for (const recommendation of result.recommendations) {
    lines.push(`### ${recommendation.id}`);
    lines.push('');
    lines.push(`- Decision: \`${recommendation.decision}\``);
    lines.push(`- Confidence: ${recommendation.confidence}`);
    lines.push(`- Because: ${recommendation.because.join('; ')}`);
    lines.push(`- Rule(s): ${recommendation.ruleIds.join(', ')}`);
    if (recommendation.alternatives?.length) lines.push(`- Alternatives: ${recommendation.alternatives.join(', ')}`);
    if (recommendation.alternativeAnalysis?.length) {
      lines.push('- Alternative analysis:');
      for (const alternative of recommendation.alternativeAnalysis) {
        lines.push(`  - ${alternative.label}: ${alternative.fit}${alternative.tradeoffs.length ? ` — ${alternative.tradeoffs.join('; ')}` : ''}`);
      }
    }
    lines.push('');
  }

  lines.push(roadmapToMarkdown(roadmap).replace(/^# Architecture Delivery Roadmap\n+/, '## Delivery roadmap\n\n'));
  return `${lines.join('\n')}\n`;
}

export function serializeBundle(bundle) {
  return `${JSON.stringify(stableObject(bundle), null, 2)}\n`;
}
