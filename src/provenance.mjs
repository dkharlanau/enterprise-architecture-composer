import { ruleById } from './rulebook.mjs';
import { glossaryEntryById } from './glossary.mjs';

export const PROVENANCE_REGISTRY_VERSION = '0.1.0';

export const PROVENANCE_SOURCES = [
  {
    id: 'source.scope.reference-model',
    evidenceType: 'internal-methodology',
    title: 'Enterprise Architecture Composer scope composition method',
    uri: 'github://dkharlanau/enterprise-architecture-composer/ARCHITECTURE.md#composition',
    effectiveOn: '2026-08-30',
    reviewedOn: '2026-08-31',
    reviewAfter: '2027-02-28',
    note: 'Defines how business scope expands into reference capabilities and responsibilities.'
  },
  {
    id: 'source.catalog.manufacturing-reference',
    evidenceType: 'heuristic',
    title: 'Manufacturing reference catalog v0.1',
    uri: 'github://dkharlanau/enterprise-architecture-composer/src/catalog.mjs',
    effectiveOn: '2026-08-30',
    reviewedOn: '2026-08-31',
    reviewAfter: '2027-02-28',
    note: 'Reference architecture knowledge; not claimed to be an industry standard or universal best practice.'
  },
  {
    id: 'source.integration.pattern-method',
    evidenceType: 'heuristic',
    title: 'Explainable integration pattern decision method',
    uri: 'github://dkharlanau/enterprise-architecture-composer/src/integration-decision.mjs',
    effectiveOn: '2026-08-31',
    reviewedOn: '2026-08-31',
    reviewAfter: '2027-02-28',
    note: 'Categorical fit logic based on explicit architecture drivers; intentionally not a universal technology score.'
  },
  {
    id: 'source.operations.contract-method',
    evidenceType: 'internal-methodology',
    title: 'Operational integration readiness method',
    uri: 'github://dkharlanau/enterprise-architecture-composer/src/handoff.mjs',
    effectiveOn: '2026-08-31',
    reviewedOn: '2026-08-31',
    reviewAfter: '2027-02-28',
    note: 'Separates architecture proposal facts from operational contract decisions.'
  },
  {
    id: 'source.security.boundary-method',
    evidenceType: 'internal-methodology',
    title: 'External trust-boundary decision method',
    uri: 'github://dkharlanau/enterprise-architecture-composer/src/engine.mjs',
    effectiveOn: '2026-08-30',
    reviewedOn: '2026-08-31',
    reviewAfter: '2027-02-28',
    note: 'Requires explicit security decisions for partner boundaries without claiming compliance.'
  },
  {
    id: 'source.transition.migration-method',
    evidenceType: 'internal-methodology',
    title: 'Current-transition-target migration method',
    uri: 'github://dkharlanau/enterprise-architecture-composer/src/transition.mjs',
    effectiveOn: '2026-08-31',
    reviewedOn: '2026-08-31',
    reviewAfter: '2027-02-28',
    note: 'Defines instance-level keep/replace/retire semantics and introduce-before-retire dependencies.'
  },
  {
    id: 'source.quality.reference-model',
    evidenceType: 'heuristic',
    title: 'Reference architecture completeness diagnostics',
    uri: 'github://dkharlanau/enterprise-architecture-composer/src/quality.mjs',
    effectiveOn: '2026-08-31',
    reviewedOn: '2026-08-31',
    reviewAfter: '2027-02-28',
    note: 'Detects structural gaps against the reference catalog; findings are review prompts, not compliance verdicts.'
  },
  {
    id: 'source.governance.decision-method',
    evidenceType: 'internal-methodology',
    title: 'Human architecture decision governance method',
    uri: 'github://dkharlanau/enterprise-architecture-composer/src/decisions.mjs',
    effectiveOn: '2026-08-31',
    reviewedOn: '2026-08-31',
    reviewAfter: '2027-02-28',
    note: 'Preserves original recommendation evidence while layering accept/reject/override decisions.'
  },
  {
    id: 'source.delivery.roadmap-method',
    evidenceType: 'internal-methodology',
    title: 'Architecture-to-delivery dependency method',
    uri: 'github://dkharlanau/enterprise-architecture-composer/src/roadmap.mjs',
    effectiveOn: '2026-08-31',
    reviewedOn: '2026-08-31',
    reviewAfter: '2027-02-28',
    note: 'Derives explicit work packages and dependency waves from composed architecture objects.'
  }
].sort((a, b) => a.id.localeCompare(b.id));

const SOURCE_INDEX = new Map(PROVENANCE_SOURCES.map((source) => [source.id, source]));

const RULE_SOURCE_BY_FAMILY = {
  scope: ['source.scope.reference-model'],
  'system-role': ['source.scope.reference-model', 'source.catalog.manufacturing-reference'],
  data: ['source.catalog.manufacturing-reference'],
  integration: ['source.integration.pattern-method'],
  operations: ['source.operations.contract-method'],
  security: ['source.security.boundary-method'],
  migration: ['source.transition.migration-method'],
  quality: ['source.quality.reference-model'],
  governance: ['source.governance.decision-method'],
  delivery: ['source.delivery.roadmap-method']
};

const CATALOG_SOURCE_BY_KIND = {
  capability: ['source.catalog.manufacturing-reference'],
  'system-role': ['source.catalog.manufacturing-reference'],
  'data-object': ['source.catalog.manufacturing-reference'],
  'integration-pattern': ['source.catalog.manufacturing-reference', 'source.integration.pattern-method'],
  process: ['source.catalog.manufacturing-reference']
};

function sourceSnapshots(ids) {
  return [...new Set(ids)]
    .sort((a, b) => a.localeCompare(b))
    .map((id) => SOURCE_INDEX.get(id))
    .filter(Boolean)
    .map((source) => structuredClone(source));
}

export function provenanceForRule(ruleId) {
  const rule = ruleById(ruleId);
  if (!rule) return { status: 'unknown-rule', ruleId, sources: [] };
  const sourceIds = RULE_SOURCE_BY_FAMILY[rule.family] ?? ['source.scope.reference-model'];
  return {
    status: 'resolved',
    ruleId,
    family: rule.family,
    maturity: rule.maturity,
    implemented: rule.implemented,
    sources: sourceSnapshots(sourceIds)
  };
}

export function provenanceForCatalogObject(objectId) {
  const entry = glossaryEntryById(objectId);
  if (!entry) return { status: 'unknown-object', objectId, sources: [] };
  return {
    status: 'resolved',
    objectId,
    kind: entry.kind,
    catalogVersion: entry.provenance.catalogVersion,
    sources: sourceSnapshots(CATALOG_SOURCE_BY_KIND[entry.kind] ?? ['source.catalog.manufacturing-reference'])
  };
}

export function provenanceForRecommendation(recommendation) {
  const objectIds = [
    ...(recommendation.objectIds ?? []),
    ...(String(recommendation.decision ?? '').includes('.') ? [recommendation.decision] : [])
  ];
  const rules = [...new Set(recommendation.ruleIds ?? [])].sort().map(provenanceForRule);
  const objects = [...new Set(objectIds)].sort()
    .map(provenanceForCatalogObject)
    .filter((item) => item.status === 'resolved');
  const sourceIds = [...new Set([
    ...rules.flatMap((item) => item.sources.map((source) => source.id)),
    ...objects.flatMap((item) => item.sources.map((source) => source.id))
  ])].sort();

  return {
    registryVersion: PROVENANCE_REGISTRY_VERSION,
    rules,
    objects,
    sources: sourceSnapshots(sourceIds)
  };
}

export function stalenessReport(asOf, sources = PROVENANCE_SOURCES) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(asOf ?? ''))) {
    throw new Error('stalenessReport requires explicit asOf date in YYYY-MM-DD format');
  }
  return {
    asOf,
    registryVersion: PROVENANCE_REGISTRY_VERSION,
    sources: sources.map((source) => ({
      id: source.id,
      evidenceType: source.evidenceType,
      reviewedOn: source.reviewedOn,
      reviewAfter: source.reviewAfter,
      status: source.reviewAfter < asOf ? 'stale' : 'current'
    })).sort((a, b) => a.id.localeCompare(b.id))
  };
}

export function resultProvenance(result, options = {}) {
  const ruleIds = new Set();
  const objectIds = new Set();

  for (const recommendation of result.recommendations ?? []) {
    for (const id of recommendation.ruleIds ?? []) ruleIds.add(id);
    for (const id of recommendation.objectIds ?? []) objectIds.add(id);
    if (String(recommendation.decision ?? '').includes('.')) objectIds.add(recommendation.decision);
  }
  for (const finding of result.findings ?? []) {
    for (const id of finding.ruleIds ?? []) ruleIds.add(id);
    for (const id of finding.objectIds ?? []) objectIds.add(id);
  }
  for (const collection of Object.values(result.blueprint ?? {})) {
    if (!Array.isArray(collection)) continue;
    for (const item of collection) objectIds.add(item.id);
  }

  const rules = [...ruleIds].sort().map(provenanceForRule);
  const objects = [...objectIds].sort().map(provenanceForCatalogObject).filter((item) => item.status === 'resolved');
  const sourceIds = [...new Set([
    ...rules.flatMap((item) => item.sources.map((source) => source.id)),
    ...objects.flatMap((item) => item.sources.map((source) => source.id))
  ])].sort();
  const sources = sourceSnapshots(sourceIds);

  return {
    registryVersion: PROVENANCE_REGISTRY_VERSION,
    rules,
    objects,
    sources,
    ...(options.asOf ? { staleness: stalenessReport(options.asOf, sources) } : {})
  };
}
