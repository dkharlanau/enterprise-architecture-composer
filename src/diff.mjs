const CATEGORY_CONFIG = [
  ['processes', 'process'],
  ['capabilities', 'capability'],
  ['systems', 'system'],
  ['dataObjects', 'data-object'],
  ['integrations', 'integration']
];

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !['reasonIds', 'because'].includes(key))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, stable(item)])
  );
}

function comparable(item) {
  return JSON.stringify(stable(item));
}

function indexById(items = []) {
  return new Map(items.map((item) => [item.id, item]));
}

function reasonTrace(result, objectId) {
  const recommendations = result.recommendations
    .filter((item) => item.decision === objectId || item.objectIds?.includes(objectId))
    .flatMap((item) => item.ruleIds ?? []);
  const findings = result.findings
    .filter((item) => item.objectIds?.includes(objectId))
    .flatMap((item) => item.ruleIds ?? []);
  const direct = [
    ...result.blueprint.processes,
    ...result.blueprint.capabilities,
    ...result.blueprint.systems,
    ...result.blueprint.dataObjects,
    ...result.blueprint.integrations
  ].find((item) => item.id === objectId)?.reasonIds ?? [];

  return [...new Set([...direct, ...recommendations, ...findings])].sort();
}

function diffCollection(baseItems, targetItems, kind, baseResult, targetResult) {
  const base = indexById(baseItems);
  const target = indexById(targetItems);
  const ids = [...new Set([...base.keys(), ...target.keys()])].sort();
  const changes = [];

  for (const id of ids) {
    const before = base.get(id);
    const after = target.get(id);

    if (!before && after) {
      changes.push({
        id,
        kind,
        change: 'added',
        before: null,
        after,
        because: reasonTrace(targetResult, id)
      });
      continue;
    }

    if (before && !after) {
      changes.push({
        id,
        kind,
        change: 'removed',
        before,
        after: null,
        because: reasonTrace(baseResult, id)
      });
      continue;
    }

    if (comparable(before) !== comparable(after)) {
      changes.push({
        id,
        kind,
        change: 'changed',
        before,
        after,
        because: [...new Set([
          ...reasonTrace(baseResult, id),
          ...reasonTrace(targetResult, id)
        ])].sort()
      });
    }
  }

  return changes;
}

function diffWorkPackages(baseResult, targetResult) {
  const base = indexById(baseResult.workPackages);
  const target = indexById(targetResult.workPackages);
  const ids = [...new Set([...base.keys(), ...target.keys()])].sort();
  const changes = [];

  for (const id of ids) {
    const before = base.get(id);
    const after = target.get(id);
    if (!before && after) {
      changes.push({ id, kind: 'work-package', change: 'added', before: null, after, because: after.sourceIds ?? [] });
    } else if (before && !after) {
      changes.push({ id, kind: 'work-package', change: 'removed', before, after: null, because: before.sourceIds ?? [] });
    } else if (comparable(before) !== comparable(after)) {
      changes.push({
        id,
        kind: 'work-package',
        change: 'changed',
        before,
        after,
        because: [...new Set([...(before.sourceIds ?? []), ...(after.sourceIds ?? [])])].sort()
      });
    }
  }

  return changes;
}

function diffReplacements(baseResult, targetResult) {
  const base = indexById(baseResult.transition?.replacements ?? []);
  const target = indexById(targetResult.transition?.replacements ?? []);
  const ids = [...new Set([...base.keys(), ...target.keys()])].sort();
  const changes = [];

  for (const id of ids) {
    const before = base.get(id);
    const after = target.get(id);
    if (!before && after) {
      changes.push({
        id,
        kind: 'replacement',
        change: 'added',
        before: null,
        after,
        because: after.ruleIds ?? ['MIG-REPLACE-001']
      });
    } else if (before && !after) {
      changes.push({
        id,
        kind: 'replacement',
        change: 'removed',
        before,
        after: null,
        because: before.ruleIds ?? ['MIG-REPLACE-001']
      });
    } else if (comparable(before) !== comparable(after)) {
      changes.push({
        id,
        kind: 'replacement',
        change: 'changed',
        before,
        after,
        because: [...new Set([...(before.ruleIds ?? []), ...(after.ruleIds ?? [])])].sort()
      });
    }
  }
  return changes;
}

export function diffCompositions(baseResult, targetResult) {
  if (!baseResult?.blueprint || !targetResult?.blueprint) {
    throw new Error('Both base and target must be composed architecture results.');
  }

  const changes = [];
  for (const [collection, kind] of CATEGORY_CONFIG) {
    changes.push(...diffCollection(
      baseResult.blueprint[collection],
      targetResult.blueprint[collection],
      kind,
      baseResult,
      targetResult
    ));
  }
  changes.push(...diffWorkPackages(baseResult, targetResult));
  changes.push(...diffReplacements(baseResult, targetResult));

  changes.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));

  const summary = {
    added: changes.filter((item) => item.change === 'added').length,
    removed: changes.filter((item) => item.change === 'removed').length,
    changed: changes.filter((item) => item.change === 'changed').length,
    replacements: changes.filter((item) => item.kind === 'replacement').length,
    total: changes.length
  };

  return {
    schemaVersion: '0.2',
    base: {
      engineVersion: baseResult.engineVersion,
      catalogVersion: baseResult.catalogVersion,
      context: baseResult.context
    },
    target: {
      engineVersion: targetResult.engineVersion,
      catalogVersion: targetResult.catalogVersion,
      context: targetResult.context
    },
    summary,
    changes,
    impactSeeds: changes
      .filter((item) => ['added', 'removed', 'changed'].includes(item.change))
      .map((item) => ({ id: item.id, kind: item.kind, change: item.change }))
  };
}
