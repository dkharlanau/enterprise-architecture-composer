import { processByKey } from './catalog.mjs';

export const CAPABILITY_SUPPORT = {
  'cap.customer-management': ['sys.crm'],
  'cap.order-management': ['sys.erp'],
  'cap.fulfilment': ['sys.erp'],
  'cap.billing': ['sys.erp'],
  'cap.supplier-management': ['sys.erp'],
  'cap.procurement': ['sys.erp'],
  'cap.production-planning': ['sys.erp'],
  'cap.production-execution': ['sys.mes'],
  'cap.warehouse-management': ['sys.wms'],
  'cap.transport-management': ['sys.tms'],
  'cap.finance': ['sys.erp'],
  'cap.master-data': ['sys.mdm'],
  'cap.analytics': ['sys.data-platform'],
  'cap.returns-management': ['sys.crm', 'sys.erp'],
  'cap.intercompany': ['sys.erp']
};

function sortedUnique(values = []) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function processIntegrationIds(process) {
  const catalogProcess = processByKey(process.key);
  return (catalogProcess?.integrationNeeds ?? [])
    .map((need) => `integration.${need.id.replace(/^need\./, '')}`)
    .sort((a, b) => a.localeCompare(b));
}

function processSystemGraph(process, result) {
  const declaredSystems = new Set((process.systemIds ?? []).filter((id) => result.blueprint.systems.some((system) => system.id === id)));
  const integrationIds = new Set(processIntegrationIds(process));
  const edges = result.blueprint.integrations
    .filter((integration) => integrationIds.has(integration.id))
    .map((integration) => [integration.source, integration.target]);

  const connected = new Set();
  for (const [source, target] of edges) {
    connected.add(source);
    connected.add(target);
  }

  return {
    declaredSystems: [...declaredSystems].sort(),
    edges,
    isolatedSystems: [...declaredSystems].filter((id) => !connected.has(id)).sort()
  };
}

function systemJustifications(systemId, result) {
  const processIds = result.blueprint.processes
    .filter((process) => (process.systemIds ?? []).includes(systemId))
    .map((process) => process.id);
  const recommendationIds = result.recommendations
    .filter((item) => item.decision === systemId || item.objectIds?.includes(systemId))
    .map((item) => item.id);
  const reasonIds = result.blueprint.systems.find((system) => system.id === systemId)?.reasonIds ?? [];
  return sortedUnique([...processIds, ...recommendationIds, ...reasonIds]);
}

export function analyzeArchitectureQuality(result) {
  const findings = [];
  const systemIds = new Set(result.blueprint.systems.map((item) => item.id));

  for (const capability of result.blueprint.capabilities) {
    const candidates = CAPABILITY_SUPPORT[capability.id] ?? [];
    if (!candidates.length) {
      findings.push({
        id: `quality.capability-model.${capability.id.replace('cap.', '')}`,
        severity: 'info',
        kind: 'catalog-quality',
        ruleIds: ['QUALITY-CAPABILITY-001'],
        objectIds: [capability.id],
        message: `${capability.name} has no reference supporting-system mapping in the manufacturing quality matrix.`,
        nextDecision: `Define at least one reference system role that can support ${capability.name}.`
      });
      continue;
    }

    if (!candidates.some((id) => systemIds.has(id))) {
      findings.push({
        id: `quality.capability-support.${capability.id.replace('cap.', '')}`,
        severity: 'warning',
        kind: 'architecture-gap',
        ruleIds: ['QUALITY-CAPABILITY-001'],
        objectIds: [capability.id, ...candidates],
        message: `${capability.name} is in scope but none of its reference supporting system roles are present.`,
        nextDecision: `Add or justify an alternative system responsibility for ${capability.name}.`
      });
    }
  }

  for (const process of result.blueprint.processes) {
    const graph = processSystemGraph(process, result);
    if (graph.declaredSystems.length <= 1) continue;

    if (!graph.edges.length) {
      findings.push({
        id: `quality.process-integration.${process.id.replace('process.', '')}`,
        severity: 'warning',
        kind: 'architecture-gap',
        ruleIds: ['QUALITY-PROCESS-INTEGRATION-001'],
        objectIds: [process.id, ...graph.declaredSystems],
        message: `${process.name} spans ${graph.declaredSystems.length} system roles but has no declared cross-system integration need.`,
        nextDecision: 'Define the required process handoffs or remove system roles that are not actually part of the process.'
      });
      continue;
    }

    if (graph.isolatedSystems.length) {
      findings.push({
        id: `quality.process-isolated-system.${process.id.replace('process.', '')}`,
        severity: 'warning',
        kind: 'architecture-gap',
        ruleIds: ['QUALITY-PROCESS-INTEGRATION-001'],
        objectIds: [process.id, ...graph.isolatedSystems],
        message: `${process.name} includes ${graph.isolatedSystems.join(', ')} but the reference process has no integration connecting those roles to the rest of the process.`,
        nextDecision: 'Define the missing handoff or remove the isolated system role from the process scope.'
      });
    }
  }

  for (const system of result.blueprint.systems) {
    const justifications = systemJustifications(system.id, result);
    if (!justifications.length) {
      findings.push({
        id: `quality.system-justification.${system.id.replace('sys.', '')}`,
        severity: 'warning',
        kind: 'architecture-gap',
        ruleIds: ['QUALITY-SYSTEM-JUSTIFICATION-001'],
        objectIds: [system.id],
        message: `${system.name} is present in the blueprint without a process, rule or recommendation that explains why it is needed.`,
        nextDecision: `Link ${system.name} to a capability/process requirement or remove it from the target architecture.`
      });
    }
  }

  const unique = [...new Map(findings.map((item) => [item.id, item])).values()].sort((a, b) => a.id.localeCompare(b.id));
  return {
    findings: unique,
    metrics: {
      unsupportedCapabilityCount: unique.filter((item) => item.id.startsWith('quality.capability-support.')).length,
      capabilityModelGapCount: unique.filter((item) => item.id.startsWith('quality.capability-model.')).length,
      processIntegrationGapCount: unique.filter((item) => item.id.startsWith('quality.process-')).length,
      unjustifiedSystemCount: unique.filter((item) => item.id.startsWith('quality.system-justification.')).length,
      totalQualityFindingCount: unique.length
    }
  };
}
