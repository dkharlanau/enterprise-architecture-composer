export const METRIC_DEFINITIONS = {
  capabilitiesWithoutSystemSupport: 'Count of in-scope capabilities for which none of the reference supporting system roles are present in the composed target.',
  processSystemSpan: 'For each process, the number of distinct target system roles declared by the reference process model.',
  integrationsByPattern: 'Count of composed integration flows grouped by the selected architecture pattern ID.',
  integrationsByMode: 'Count of composed integration flows grouped by sync/async/batch mode.',
  fanOutProfile: 'Count of composed integrations grouped by the explicit/effective fan-out value used by the integration decision model.',
  dataObjectsWithoutSystemOfRecord: 'Count and IDs of composed business data objects without an authoritative owner in target scope.',
  integrationDependencyDegree: 'For each system role, number of composed integration flows in which it participates as source or target. This is connectivity concentration, not a failure-risk score.',
  unresolvedDecisionCount: 'Count of warning/error findings that still require an architecture decision.',
  mandatoryWorkPackagesByPhase: 'Count of mandatory work packages grouped by delivery phase.',
  conditionalWorkPackageCount: 'Count of work packages that exist only when a condition or retained constraint applies.',
  migrationStructure: 'Counts of explicit replacements, coexistence windows and transition application/integration instances when currentLandscape is supplied.'
};

function sortedObject(entries) {
  return Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b)));
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return sortedObject(counts.entries());
}

function processSystemSpan(result) {
  return result.blueprint.processes
    .map((process) => ({
      processId: process.id,
      name: process.name,
      systemRoleCount: new Set(process.systemIds ?? []).size,
      systemRoleIds: [...new Set(process.systemIds ?? [])].sort((a, b) => a.localeCompare(b))
    }))
    .sort((a, b) => a.processId.localeCompare(b.processId));
}

function integrationDependencyDegree(result) {
  const degree = new Map(result.blueprint.systems.map((system) => [system.id, { inbound: 0, outbound: 0, total: 0 }]));
  for (const integration of result.blueprint.integrations) {
    if (!degree.has(integration.source)) degree.set(integration.source, { inbound: 0, outbound: 0, total: 0 });
    if (!degree.has(integration.target)) degree.set(integration.target, { inbound: 0, outbound: 0, total: 0 });
    degree.get(integration.source).outbound += 1;
    degree.get(integration.source).total += 1;
    degree.get(integration.target).inbound += 1;
    degree.get(integration.target).total += 1;
  }
  return [...degree.entries()]
    .map(([systemId, counts]) => ({ systemId, ...counts }))
    .sort((a, b) => b.total - a.total || a.systemId.localeCompare(b.systemId));
}

function mandatoryByPhase(result) {
  const mandatory = result.workPackages.filter((item) => item.mandatory !== false && ![
    'wp.cutover.wms-coexistence',
    'wp.security.partner-boundary'
  ].includes(item.id));
  return countBy(mandatory, (item) => item.phase);
}

export function calculateArchitectureMetrics(result) {
  const ownerGaps = result.blueprint.dataObjects.filter((item) => !item.owner).map((item) => item.id).sort();
  const unresolved = result.findings.filter((item) => ['warning', 'error'].includes(item.severity));
  const conditionalIds = result.workPackages
    .filter((item) => item.mandatory === false || ['wp.cutover.wms-coexistence', 'wp.security.partner-boundary'].includes(item.id))
    .map((item) => item.id)
    .sort();
  const capabilitySupportGapIds = result.findings
    .filter((item) => item.id.startsWith('quality.capability-support.'))
    .map((item) => item.objectIds?.[0])
    .filter(Boolean)
    .sort();

  return {
    schemaVersion: '0.1',
    definitions: METRIC_DEFINITIONS,
    structure: {
      processCount: result.blueprint.processes.length,
      capabilityCount: result.blueprint.capabilities.length,
      systemRoleCount: result.blueprint.systems.length,
      integrationCount: result.blueprint.integrations.length,
      dataObjectCount: result.blueprint.dataObjects.length
    },
    capabilitiesWithoutSystemSupport: {
      count: capabilitySupportGapIds.length,
      capabilityIds: capabilitySupportGapIds
    },
    processSystemSpan: processSystemSpan(result),
    integrationsByPattern: countBy(result.blueprint.integrations, (item) => item.patternId),
    integrationsByMode: countBy(result.blueprint.integrations, (item) => item.mode),
    fanOutProfile: countBy(result.blueprint.integrations, (item) => String(item.decisionAnalysis?.drivers?.fanOut ?? 1)),
    dataObjectsWithoutSystemOfRecord: {
      count: ownerGaps.length,
      dataObjectIds: ownerGaps
    },
    integrationDependencyDegree: integrationDependencyDegree(result),
    unresolvedDecisionCount: unresolved.length,
    unresolvedDecisionIds: unresolved.map((item) => item.id).sort(),
    mandatoryWorkPackagesByPhase: mandatoryByPhase(result),
    conditionalWorkPackageCount: conditionalIds.length,
    conditionalWorkPackageIds: conditionalIds,
    migrationStructure: {
      replacementCount: result.transition?.replacements?.length ?? 0,
      coexistenceWindowCount: result.transition?.coexistenceWindows?.length ?? 0,
      transitionSystemInstanceCount: result.transition?.systems?.length ?? 0,
      transitionIntegrationInstanceCount: result.transition?.integrations?.length ?? 0
    }
  };
}
