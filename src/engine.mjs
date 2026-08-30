import {
  CATALOG_VERSION,
  capabilities,
  systems,
  dataObjects,
  integrationPatterns,
  processes,
  byId,
  processByKey
} from './catalog.mjs';

export const ENGINE_VERSION = '0.1.0';

export const RULES = [
  { id: 'SCOPE-MULTICOMPANY-001', family: 'scope', description: 'Multi-company operation requires explicit intercompany and master-data architecture scope.' },
  { id: 'SCOPE-MASTERDATA-001', family: 'scope', description: 'Broad cross-process scope requires explicit shared master-data responsibility.' },
  { id: 'SYS-INTEGRATION-001', family: 'system-role', description: 'A high-volume or integration-rich landscape requires an explicit integration-platform responsibility.' },
  { id: 'INT-SYNC-001', family: 'integration', description: 'Immediate business response favors synchronous request/response.' },
  { id: 'INT-B2B-001', family: 'integration', description: 'Trading-partner document exchange favors a B2B/EDI boundary.' },
  { id: 'INT-ANALYTICS-001', family: 'integration', description: 'Analytical publication favors ETL/ELT into a data platform.' },
  { id: 'INT-EVENT-001', family: 'integration', description: 'A non-blocking business fact with multiple consumers favors a domain event.' },
  { id: 'INT-ASYNC-001', family: 'integration', description: 'A non-blocking one-to-one state transfer favors asynchronous messaging.' },
  { id: 'INT-ASYNC-002', family: 'integration', description: 'High-volume non-blocking transfer strengthens the case for asynchronous messaging.' },
  { id: 'DATA-OWNER-001', family: 'quality', description: 'A business data object requires explicit authoritative ownership.' },
  { id: 'OPS-ASYNC-001', family: 'quality', description: 'Asynchronous flows require explicit replay, monitoring and reconciliation decisions.' },
  { id: 'SEC-PARTNER-001', family: 'quality', description: 'A partner boundary requires explicit trust, identity and security decisions.' },
  { id: 'MIG-WMS-001', family: 'migration', description: 'Retained legacy WMS requires an explicit coexistence and retirement boundary.' }
];

const SYSTEM_ALIASES = {
  crm: 'sys.crm',
  erp: 'sys.erp',
  mdm: 'sys.mdm',
  wms: 'sys.wms',
  'legacy-wms': 'sys.wms',
  mes: 'sys.mes',
  tms: 'sys.tms',
  integration: 'sys.integration',
  'integration-platform': 'sys.integration',
  'data-platform': 'sys.data-platform',
  'partner-edge': 'sys.partner-edge'
};

const PHASE_ORDER = {
  architecture: 10,
  foundation: 20,
  data: 30,
  security: 40,
  integration: 50,
  assurance: 60,
  testing: 70,
  cutover: 80
};

function sortedUnique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function asPositiveInteger(value, fallback = 1) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function normalizeSystemId(value) {
  if (typeof value !== 'string') return null;
  if (value.startsWith('sys.')) return byId(systems, value) ? value : null;
  return SYSTEM_ALIASES[value] ?? null;
}

export function normalizeContext(input = {}) {
  const rawProcesses = Array.isArray(input.processes) && input.processes.length
    ? input.processes
    : ['order-to-cash'];

  const processKeys = sortedUnique(rawProcesses.map(String));
  const unknownProcesses = processKeys.filter((key) => !processByKey(key));
  if (unknownProcesses.length) {
    throw new Error(`Unknown process key(s): ${unknownProcesses.join(', ')}`);
  }

  const existingSystemIds = sortedUnique(
    (Array.isArray(input.existingSystems) ? input.existingSystems : [])
      .map(normalizeSystemId)
      .filter(Boolean)
  );

  const constraints = input.constraints ?? {};
  const scale = input.scale ?? {};

  return {
    industry: String(input.industry ?? 'manufacturing'),
    operatingModel: String(input.operatingModel ?? 'b2b'),
    processes: processKeys,
    scale: {
      countries: asPositiveInteger(scale.countries, 1),
      legalEntities: asPositiveInteger(scale.legalEntities, 1),
      plants: asPositiveInteger(scale.plants, 1),
      warehouses: asPositiveInteger(scale.warehouses, 1)
    },
    constraints: {
      multiCompany: Boolean(constraints.multiCompany),
      highVolume: Boolean(constraints.highVolume),
      retainLegacyWms: Boolean(constraints.retainLegacyWms)
    },
    existingSystemIds
  };
}

function addReason(map, objectId, reasonId) {
  if (!map.has(objectId)) map.set(objectId, new Set());
  map.get(objectId).add(reasonId);
}

function materialize(collection, ids, reasonMap, additional = () => ({})) {
  return sortedUnique(ids).map((id) => {
    const item = byId(collection, id);
    if (!item) throw new Error(`Catalog object not found: ${id}`);
    return {
      ...item,
      reasonIds: sortedUnique([...(reasonMap.get(id) ?? [])]),
      ...additional(item)
    };
  });
}

function chooseIntegrationPattern(need, context) {
  if (need.partnerBoundary) {
    return {
      patternId: 'pattern.edi-b2b',
      confidence: 'high',
      ruleIds: ['INT-B2B-001'],
      because: ['the flow crosses a trading-partner boundary', 'the payload is a structured business document'],
      alternatives: ['pattern.async-message']
    };
  }

  if (need.purpose === 'analytics') {
    return {
      patternId: 'pattern.etl-elt',
      confidence: 'high',
      ruleIds: ['INT-ANALYTICS-001'],
      because: ['the target is an analytical data platform', 'the consumer does not participate in the transactional response'],
      alternatives: ['pattern.cdc']
    };
  }

  if (need.immediateResponse) {
    return {
      patternId: 'pattern.sync-api',
      confidence: 'high',
      ruleIds: ['INT-SYNC-001'],
      because: ['the caller requires an immediate business response', 'the interaction has one principal target'],
      alternatives: ['pattern.async-message']
    };
  }

  if (need.fanOut >= 2) {
    return {
      patternId: 'pattern.domain-event',
      confidence: context.constraints.highVolume ? 'high' : 'medium',
      ruleIds: ['INT-EVENT-001'],
      because: [
        'the producer does not need to block on downstream processing',
        'the business fact can be consumed by multiple downstream responsibilities',
        ...(context.constraints.highVolume ? ['the enterprise context is marked high-volume'] : [])
      ],
      alternatives: ['pattern.async-message']
    };
  }

  if (context.constraints.highVolume) {
    return {
      patternId: 'pattern.async-message',
      confidence: 'high',
      ruleIds: ['INT-ASYNC-002'],
      because: ['the transfer is non-blocking', 'the enterprise context is marked high-volume'],
      alternatives: ['pattern.batch-file']
    };
  }

  return {
    patternId: 'pattern.async-message',
    confidence: 'medium',
    ruleIds: ['INT-ASYNC-001'],
    because: ['the transfer is non-blocking', 'there is one principal downstream responsibility'],
    alternatives: ['pattern.batch-file']
  };
}

function buildWorkPackages({ context, systemIds, dataBlueprint, integrations, findings }) {
  const work = [];
  const push = (item) => work.push({ mandatory: true, dependsOn: [], sourceIds: [], ...item });

  push({
    id: 'wp.architecture.resolve-decisions',
    phase: 'architecture',
    title: 'Confirm architecture assumptions and unresolved decisions',
    sourceIds: findings.filter((f) => f.kind === 'question').map((f) => f.id)
  });

  if (systemIds.has('sys.integration')) {
    push({
      id: 'wp.foundation.integration-platform',
      phase: 'foundation',
      title: 'Establish integration-platform responsibility and operating model',
      sourceIds: ['sys.integration'],
      dependsOn: ['wp.architecture.resolve-decisions']
    });
  }

  if (systemIds.has('sys.mdm')) {
    push({
      id: 'wp.data.master-data',
      phase: 'data',
      title: 'Define master-data ownership and governance boundaries',
      sourceIds: dataBlueprint.filter((d) => d.defaultOwner === 'sys.mdm').map((d) => d.id),
      dependsOn: ['wp.architecture.resolve-decisions']
    });
  }

  const integrationPackageIds = [];
  for (const integration of integrations) {
    const id = `wp.integration.${integration.id.replace('integration.', '')}`;
    integrationPackageIds.push(id);
    push({
      id,
      phase: 'integration',
      title: `Design and implement ${integration.name}`,
      sourceIds: [integration.id, integration.source, integration.target, integration.dataObject],
      dependsOn: systemIds.has('sys.integration') ? ['wp.foundation.integration-platform'] : ['wp.architecture.resolve-decisions']
    });
  }

  const partnerIntegrations = integrations.filter((integration) => integration.partnerBoundary);
  if (partnerIntegrations.length) {
    push({
      id: 'wp.security.partner-boundary',
      phase: 'security',
      title: 'Define partner trust, identity and transport-security boundary',
      sourceIds: partnerIntegrations.map((integration) => integration.id),
      dependsOn: ['wp.architecture.resolve-decisions']
    });
  }

  const asyncIntegrations = integrations.filter((integration) => integration.mode === 'async');
  if (asyncIntegrations.length) {
    push({
      id: 'wp.assurance.async-flows',
      phase: 'assurance',
      title: 'Define monitoring, replay and reconciliation for asynchronous flows',
      sourceIds: asyncIntegrations.map((integration) => integration.id),
      dependsOn: integrationPackageIds
    });
  }

  if (integrationPackageIds.length) {
    push({
      id: 'wp.testing.end-to-end',
      phase: 'testing',
      title: 'Build cross-system end-to-end and failure-path test scope',
      sourceIds: integrations.map((integration) => integration.id),
      dependsOn: sortedUnique([
        ...integrationPackageIds,
        ...(asyncIntegrations.length ? ['wp.assurance.async-flows'] : []),
        ...(partnerIntegrations.length ? ['wp.security.partner-boundary'] : [])
      ])
    });
  }

  if (context.constraints.retainLegacyWms && systemIds.has('sys.wms')) {
    const wmsPackages = integrations
      .filter((i) => i.source === 'sys.wms' || i.target === 'sys.wms')
      .map((i) => `wp.integration.${i.id.replace('integration.', '')}`);
    push({
      id: 'wp.cutover.wms-coexistence',
      phase: 'cutover',
      title: 'Plan legacy WMS coexistence, cutover boundaries and retirement criteria',
      sourceIds: ['sys.wms'],
      dependsOn: sortedUnique(wmsPackages)
    });
  }

  return work.sort((a, b) => {
    const phase = (PHASE_ORDER[a.phase] ?? 999) - (PHASE_ORDER[b.phase] ?? 999);
    return phase || a.id.localeCompare(b.id);
  });
}

export function composeArchitecture(input = {}) {
  const context = normalizeContext(input);
  const selectedProcesses = context.processes.map(processByKey);

  const capabilityIds = new Set();
  const systemIds = new Set();
  const dataIds = new Set();
  const integrationNeedMap = new Map();
  const capabilityReasons = new Map();
  const systemReasons = new Map();
  const dataReasons = new Map();

  for (const process of selectedProcesses) {
    for (const id of process.capabilityIds) {
      capabilityIds.add(id);
      addReason(capabilityReasons, id, process.id);
    }
    for (const id of process.systemIds) {
      systemIds.add(id);
      addReason(systemReasons, id, process.id);
    }
    for (const id of process.dataIds) {
      dataIds.add(id);
      addReason(dataReasons, id, process.id);
    }
    for (const need of process.integrationNeeds) {
      if (!integrationNeedMap.has(need.id)) integrationNeedMap.set(need.id, need);
    }
  }

  const recommendations = [];

  if (context.constraints.multiCompany) {
    capabilityIds.add('cap.intercompany');
    addReason(capabilityReasons, 'cap.intercompany', 'SCOPE-MULTICOMPANY-001');
    capabilityIds.add('cap.master-data');
    addReason(capabilityReasons, 'cap.master-data', 'SCOPE-MULTICOMPANY-001');
    systemIds.add('sys.mdm');
    addReason(systemReasons, 'sys.mdm', 'SCOPE-MULTICOMPANY-001');
    recommendations.push({
      id: 'rec.multicompany.master-data',
      kind: 'system-role',
      decision: 'sys.mdm',
      confidence: 'high',
      because: ['multiple legal entities increase the need for explicit shared master-data ownership'],
      ruleIds: ['SCOPE-MULTICOMPANY-001'],
      alternatives: []
    });
  }

  if (selectedProcesses.length >= 3) {
    capabilityIds.add('cap.master-data');
    addReason(capabilityReasons, 'cap.master-data', 'SCOPE-MASTERDATA-001');
    systemIds.add('sys.mdm');
    addReason(systemReasons, 'sys.mdm', 'SCOPE-MASTERDATA-001');
  }

  if (integrationNeedMap.size >= 3 || context.constraints.highVolume) {
    systemIds.add('sys.integration');
    addReason(systemReasons, 'sys.integration', 'SYS-INTEGRATION-001');
    recommendations.push({
      id: 'rec.integration.platform',
      kind: 'system-role',
      decision: 'sys.integration',
      confidence: integrationNeedMap.size >= 3 ? 'high' : 'medium',
      because: [
        ...(integrationNeedMap.size >= 3 ? [`the selected scope contains ${integrationNeedMap.size} cross-system integration needs`] : []),
        ...(context.constraints.highVolume ? ['the enterprise context is marked high-volume'] : [])
      ],
      ruleIds: ['SYS-INTEGRATION-001'],
      alternatives: []
    });
  }

  const integrations = [...integrationNeedMap.values()]
    .map((need) => {
      const decision = chooseIntegrationPattern(need, context);
      const pattern = byId(integrationPatterns, decision.patternId);
      const integration = {
        id: `integration.${need.id.replace('need.', '')}`,
        kind: 'integration',
        name: need.name,
        source: need.source,
        target: need.target,
        dataObject: need.dataObject,
        partnerBoundary: need.partnerBoundary,
        patternId: decision.patternId,
        patternName: pattern.name,
        mode: decision.patternId === 'pattern.sync-api' ? 'sync' : 'async',
        confidence: decision.confidence,
        because: decision.because,
        ruleIds: decision.ruleIds,
        alternatives: decision.alternatives
      };

      recommendations.push({
        id: `rec.${integration.id}`,
        kind: 'integration-pattern',
        decision: decision.patternId,
        confidence: decision.confidence,
        because: decision.because,
        ruleIds: decision.ruleIds,
        alternatives: decision.alternatives,
        objectIds: [integration.id, need.source, need.target, need.dataObject]
      });

      return integration;
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const processBlueprint = selectedProcesses
    .map((process) => ({ ...process, integrationNeeds: undefined, reasonIds: [process.id] }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const capabilityBlueprint = materialize(capabilities, capabilityIds, capabilityReasons);
  const systemBlueprint = materialize(systems, systemIds, systemReasons, (system) => ({
    state: context.existingSystemIds.includes(system.id) ? 'current' : 'target',
    intent: context.existingSystemIds.includes(system.id) ? 'keep' : 'introduce'
  }));

  const dataBlueprint = materialize(dataObjects, dataIds, dataReasons, (dataObject) => ({
    owner: systemIds.has(dataObject.defaultOwner) ? dataObject.defaultOwner : null
  }));

  const findings = [];

  for (const dataObject of dataBlueprint) {
    if (!dataObject.owner) {
      findings.push({
        id: `finding.owner.${dataObject.id.replace('data.', '')}`,
        severity: 'warning',
        kind: 'question',
        ruleIds: ['DATA-OWNER-001'],
        objectIds: [dataObject.id],
        message: `${dataObject.name} has no explicit system-of-record responsibility in the composed system scope.`,
        nextDecision: `Confirm the authoritative owner for ${dataObject.name}.`
      });
    }
  }

  for (const integration of integrations.filter((item) => item.mode === 'async')) {
    findings.push({
      id: `finding.async.${integration.id.replace('integration.', '')}`,
      severity: 'info',
      kind: 'operational-decision',
      ruleIds: ['OPS-ASYNC-001'],
      objectIds: [integration.id],
      message: `${integration.name} is asynchronous and requires monitoring, replay and reconciliation decisions.`,
      nextDecision: 'Define failure ownership, replay safety, observability and reconciliation.'
    });
  }

  for (const integration of integrations.filter((item) => item.partnerBoundary)) {
    findings.push({
      id: `finding.security.${integration.id.replace('integration.', '')}`,
      severity: 'warning',
      kind: 'security-decision',
      ruleIds: ['SEC-PARTNER-001'],
      objectIds: [integration.id],
      message: `${integration.name} crosses an external partner boundary.`,
      nextDecision: 'Define partner identity, trust, transport security and audit requirements.'
    });
  }

  if (context.constraints.multiCompany && !context.processes.includes('intercompany')) {
    findings.push({
      id: 'finding.multicompany.intercompany-scope',
      severity: 'warning',
      kind: 'question',
      ruleIds: ['SCOPE-MULTICOMPANY-001'],
      objectIds: ['cap.intercompany'],
      message: 'The enterprise is multi-company, but the Intercompany process is not included in the selected scope.',
      nextDecision: 'Confirm whether intercompany commercial/logistics flows are out of scope or still need design.'
    });
  }

  if (context.constraints.retainLegacyWms && systemIds.has('sys.wms')) {
    recommendations.push({
      id: 'rec.migration.retain-wms',
      kind: 'migration',
      decision: 'retain-wms-boundary',
      confidence: 'conditional',
      because: ['the context explicitly requires the legacy WMS to remain'],
      ruleIds: ['MIG-WMS-001'],
      alternatives: ['replace-wms']
    });
  }

  findings.sort((a, b) => a.id.localeCompare(b.id));
  recommendations.sort((a, b) => a.id.localeCompare(b.id));

  const workPackages = buildWorkPackages({
    context,
    systemIds,
    dataBlueprint,
    integrations,
    findings
  });

  const result = {
    schemaVersion: '0.1',
    engineVersion: ENGINE_VERSION,
    catalogVersion: CATALOG_VERSION,
    context,
    blueprint: {
      processes: processBlueprint,
      capabilities: capabilityBlueprint,
      systems: systemBlueprint,
      dataObjects: dataBlueprint,
      integrations
    },
    recommendations,
    findings,
    workPackages,
    metrics: {
      processCount: processBlueprint.length,
      capabilityCount: capabilityBlueprint.length,
      systemCount: systemBlueprint.length,
      integrationCount: integrations.length,
      asyncIntegrationCount: integrations.filter((i) => i.mode === 'async').length,
      unresolvedDataOwnerCount: dataBlueprint.filter((d) => !d.owner).length,
      findingCount: findings.length,
      workPackageCount: workPackages.length
    }
  };

  return result;
}

export function explainObject(result, objectId) {
  const collections = [
    result.blueprint.processes,
    result.blueprint.capabilities,
    result.blueprint.systems,
    result.blueprint.dataObjects,
    result.blueprint.integrations
  ];
  const object = collections.flat().find((item) => item.id === objectId) ?? null;
  const recommendations = result.recommendations.filter((item) =>
    item.decision === objectId || item.objectIds?.includes(objectId)
  );
  const findings = result.findings.filter((item) => item.objectIds?.includes(objectId));
  const workPackages = result.workPackages.filter((item) => item.sourceIds?.includes(objectId));
  return { object, recommendations, findings, workPackages };
}

export function serializeComposition(result) {
  return `${JSON.stringify(result, null, 2)}\n`;
}
