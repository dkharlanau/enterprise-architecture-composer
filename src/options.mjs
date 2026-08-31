import { composeArchitecture } from './composer.mjs';
import { calculateArchitectureMetrics } from './metrics.mjs';

const FIT_ORDER = { clear: 0, attention: 1, blocked: 2 };

function burdenCategory(value, thresholds) {
  if (value <= thresholds[0]) return 'low';
  if (value <= thresholds[1]) return 'medium';
  return 'high';
}

function constraintFit(result) {
  const errors = result.findings.filter((item) => item.severity === 'error');
  const warnings = result.findings.filter((item) => item.severity === 'warning');
  if (errors.length) return { category: 'blocked', errorCount: errors.length, warningCount: warnings.length };
  if (warnings.length) return { category: 'attention', errorCount: 0, warningCount: warnings.length };
  return { category: 'clear', errorCount: 0, warningCount: 0 };
}

function consistencyModels(result) {
  return [...new Set(result.blueprint.integrations
    .map((item) => item.decisionAnalysis?.drivers?.consistency)
    .filter(Boolean))].sort();
}

function legacyDependencies(result) {
  const transition = result.transition;
  if (!transition) return [];
  return transition.systems
    .filter((item) => item.states?.includes('current') && !item.states?.includes('target'))
    .map((item) => ({ id: item.id, roleId: item.roleId, intent: item.intent }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function optionFacts(option) {
  const result = composeArchitecture(option.context);
  const metrics = calculateArchitectureMetrics(result);
  const fit = constraintFit(result);
  const maxDegree = Math.max(0, ...metrics.integrationDependencyDegree.map((item) => item.total));
  const asyncCount = result.blueprint.integrations.filter((item) => item.mode === 'async').length;
  const partnerCount = result.blueprint.integrations.filter((item) => item.partnerBoundary).length;
  const migrationPackageCount = result.workPackages.filter((item) => item.id.startsWith('wp.transition.')).length;
  const legacy = legacyDependencies(result);

  return {
    id: option.id,
    label: option.label ?? option.id,
    context: option.context,
    result,
    dimensions: {
      constraintFit: fit,
      coupling: {
        category: burdenCategory(maxDegree, [2, 4]),
        integrationCount: result.blueprint.integrations.length,
        maxSystemIntegrationDegree: maxDegree,
        mostConnectedSystemIds: metrics.integrationDependencyDegree
          .filter((item) => item.total === maxDegree && maxDegree > 0)
          .map((item) => item.systemId)
      },
      operationalComplexity: {
        category: burdenCategory(asyncCount + partnerCount, [2, 5]),
        asyncIntegrationCount: asyncCount,
        partnerBoundaryCount: partnerCount,
        operationalDecisionCount: result.findings.filter((item) => ['operational-decision', 'security-decision'].includes(item.kind)).length
      },
      dataConsistencyModel: {
        models: consistencyModels(result),
        unresolvedOwnerCount: metrics.dataObjectsWithoutSystemOfRecord.count
      },
      migrationEffort: {
        category: migrationPackageCount === 0 ? 'none' : migrationPackageCount <= 3 ? 'moderate' : 'significant',
        migrationWorkPackageCount: migrationPackageCount,
        replacementCount: result.transition?.replacements?.length ?? 0,
        coexistenceWindowCount: result.transition?.coexistenceWindows?.length ?? 0
      },
      retainedLegacyDependencies: {
        count: legacy.length,
        items: legacy
      },
      unresolvedAssumptions: {
        count: result.findings.filter((item) => ['warning', 'error'].includes(item.severity)).length,
        findingIds: result.findings.filter((item) => ['warning', 'error'].includes(item.severity)).map((item) => item.id).sort()
      }
    }
  };
}

function burdenVector(option) {
  const d = option.dimensions;
  return {
    constraintFit: FIT_ORDER[d.constraintFit.category],
    architectureGaps: option.result.metrics.totalQualityFindingCount ?? 0,
    unresolved: d.unresolvedAssumptions.count,
    coupling: d.coupling.maxSystemIntegrationDegree,
    migration: d.migrationEffort.migrationWorkPackageCount,
    legacy: d.retainedLegacyDependencies.count
  };
}

function dominates(a, b) {
  const av = burdenVector(a);
  const bv = burdenVector(b);
  const keys = Object.keys(av);
  const noWorse = keys.every((key) => av[key] <= bv[key]);
  const betterSomewhere = keys.some((key) => av[key] < bv[key]);
  return noWorse && betterSomewhere;
}

function dominanceReasons(a, b) {
  const av = burdenVector(a);
  const bv = burdenVector(b);
  return Object.keys(av)
    .filter((key) => av[key] < bv[key])
    .map((key) => `${key}: ${av[key]} < ${bv[key]}`);
}

export function compareSolutionOptions(options = []) {
  if (!Array.isArray(options) || options.length < 2) throw new Error('compareSolutionOptions requires at least two options');
  const ids = options.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error('Solution option IDs must be unique');

  const evaluated = options.map(optionFacts).sort((a, b) => a.id.localeCompare(b.id));
  const dominance = [];

  for (const candidate of evaluated) {
    for (const other of evaluated) {
      if (candidate.id === other.id) continue;
      if (dominates(candidate, other)) {
        dominance.push({
          dominantOptionId: candidate.id,
          dominatedOptionId: other.id,
          reasons: dominanceReasons(candidate, other)
        });
      }
    }
  }

  const dominatedIds = new Set(dominance.map((item) => item.dominatedOptionId));
  const preferredOptionIds = evaluated.filter((item) => !dominatedIds.has(item.id)).map((item) => item.id);

  return {
    schemaVersion: '0.1',
    method: {
      name: 'explicit-burden-pareto',
      scoreFree: true,
      description: 'An option is non-dominated when no other option is equal-or-better on every explicit burden dimension and strictly better on at least one. This is not a universal architecture ranking.',
      burdenDimensions: ['constraintFit', 'architectureGaps', 'unresolved', 'coupling', 'migration', 'legacy']
    },
    options: evaluated.map(({ result, ...item }) => ({
      ...item,
      blueprintSummary: {
        processCount: result.blueprint.processes.length,
        systemRoleCount: result.blueprint.systems.length,
        integrationCount: result.blueprint.integrations.length,
        findingCount: result.findings.length,
        workPackageCount: result.workPackages.length
      }
    })),
    dominance: dominance.sort((a, b) => a.dominantOptionId.localeCompare(b.dominantOptionId) || a.dominatedOptionId.localeCompare(b.dominatedOptionId)),
    preferredOptionIds,
    disqualifiedOptionIds: evaluated.filter((item) => item.dimensions.constraintFit.category === 'blocked').map((item) => item.id),
    note: preferredOptionIds.length === 1
      ? `${preferredOptionIds[0]} is the only non-dominated option under the published burden dimensions; this does not make it universally best.`
      : `${preferredOptionIds.join(', ')} are non-dominated under the published burden dimensions; choose using explicit business priorities rather than a hidden aggregate score.`
  };
}
