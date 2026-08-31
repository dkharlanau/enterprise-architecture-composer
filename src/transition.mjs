import { systems, byId } from './catalog.mjs';

const STRATEGIES = new Set(['keep', 'replace', 'retire', 'undecided']);

function sortedUnique(values = []) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function targetSystemId(roleId) {
  return `target.${roleId.replace(/^sys\./, '')}`;
}

function targetIntegrationInstanceId(integrationId) {
  return `target.${integrationId.replace(/^integration\./, 'integration.')}`;
}

function validateSystemInput(item) {
  if (!item?.id || typeof item.id !== 'string') throw new Error('currentLandscape.systems[].id is required');
  if (!item?.name || typeof item.name !== 'string') throw new Error(`currentLandscape system ${item.id} requires name`);
  if (!byId(systems, item.roleId)) throw new Error(`Unknown currentLandscape roleId: ${item.roleId}`);
  const strategy = item.strategy ?? 'undecided';
  if (!STRATEGIES.has(strategy)) throw new Error(`Invalid currentLandscape strategy for ${item.id}: ${strategy}`);
  if (item.replacementRoleId && !byId(systems, item.replacementRoleId)) throw new Error(`Unknown replacementRoleId for ${item.id}: ${item.replacementRoleId}`);
  return { ...item, strategy };
}

function validateIntegrationInput(item) {
  if (!item?.id || typeof item.id !== 'string') throw new Error('currentLandscape.integrations[].id is required');
  if (!item?.name || typeof item.name !== 'string') throw new Error(`currentLandscape integration ${item.id} requires name`);
  const strategy = item.strategy ?? 'undecided';
  if (!STRATEGIES.has(strategy)) throw new Error(`Invalid integration strategy for ${item.id}: ${strategy}`);
  if (!item.sourceSystemId || !item.targetSystemId) throw new Error(`Current integration ${item.id} requires sourceSystemId and targetSystemId`);
  return { ...item, strategy };
}

function currentSystemRecord(item, targetRoleIds) {
  const roleRequired = targetRoleIds.has(item.roleId);
  if (item.strategy === 'keep') {
    return {
      id: item.id,
      name: item.name,
      kind: 'application-instance',
      roleId: item.roleId,
      states: roleRequired ? ['current', 'target'] : ['current', 'transition'],
      intent: roleRequired ? 'keep' : 'keep-outside-target',
      source: 'current-landscape'
    };
  }
  if (item.strategy === 'replace') {
    return {
      id: item.id,
      name: item.name,
      kind: 'application-instance',
      roleId: item.roleId,
      states: ['current', 'transition'],
      intent: 'replace',
      source: 'current-landscape'
    };
  }
  if (item.strategy === 'retire') {
    return {
      id: item.id,
      name: item.name,
      kind: 'application-instance',
      roleId: item.roleId,
      states: ['current', 'transition'],
      intent: 'retire',
      source: 'current-landscape'
    };
  }
  return {
    id: item.id,
    name: item.name,
    kind: 'application-instance',
    roleId: item.roleId,
    states: ['current'],
    intent: 'undecided',
    source: 'current-landscape'
  };
}

function targetSystemRecord(roleId, replaces = []) {
  const role = byId(systems, roleId);
  return {
    id: targetSystemId(roleId),
    name: `Target ${role?.name ?? roleId}`,
    kind: 'application-instance',
    roleId,
    states: replaces.length ? ['transition', 'target'] : ['target'],
    intent: 'introduce',
    replaces: sortedUnique(replaces),
    source: 'composed-target-role'
  };
}

function currentIntegrationRecord(item, targetIds) {
  const targetExists = item.targetIntegrationId && targetIds.has(item.targetIntegrationId);
  const keep = item.strategy === 'keep' && targetExists;
  return {
    id: item.id,
    name: item.name,
    kind: 'integration-instance',
    sourceSystemId: item.sourceSystemId,
    targetSystemId: item.targetSystemId,
    targetIntegrationId: item.targetIntegrationId ?? null,
    states: keep ? ['current', 'target'] : item.strategy === 'undecided' ? ['current'] : ['current', 'transition'],
    intent: keep ? 'keep' : item.strategy,
    source: 'current-landscape'
  };
}

export function buildTransitionArchitecture(result, currentLandscape = null) {
  if (!currentLandscape) return null;

  const currentSystems = (currentLandscape.systems ?? []).map(validateSystemInput).sort((a, b) => a.id.localeCompare(b.id));
  const currentIntegrations = (currentLandscape.integrations ?? []).map(validateIntegrationInput).sort((a, b) => a.id.localeCompare(b.id));
  const duplicateSystemIds = currentSystems.filter((item, index, all) => all.findIndex((other) => other.id === item.id) !== index).map((item) => item.id);
  if (duplicateSystemIds.length) throw new Error(`Duplicate currentLandscape system IDs: ${sortedUnique(duplicateSystemIds).join(', ')}`);

  const currentSystemIds = new Set(currentSystems.map((item) => item.id));
  for (const integration of currentIntegrations) {
    if (!currentSystemIds.has(integration.sourceSystemId) || !currentSystemIds.has(integration.targetSystemId)) {
      throw new Error(`Current integration ${integration.id} references a system instance not present in currentLandscape.systems`);
    }
  }

  const targetRoleIds = new Set(result.blueprint.systems.map((item) => item.id));
  const targetIntegrationIds = new Set(result.blueprint.integrations.map((item) => item.id));
  const systemRecords = currentSystems.map((item) => currentSystemRecord(item, targetRoleIds));
  const replacementMap = new Map();
  const coveredTargetRoles = new Set();
  const findings = [];
  const replacements = [];
  const dependencies = [];
  const coexistenceWindows = [];
  const workPackages = [];

  for (const current of currentSystems) {
    if (current.strategy === 'keep' && targetRoleIds.has(current.roleId)) coveredTargetRoles.add(current.roleId);

    if (current.strategy === 'replace') {
      const replacementRoleId = current.replacementRoleId ?? current.roleId;
      if (!targetRoleIds.has(replacementRoleId)) {
        findings.push({
          id: `transition.replacement-outside-target.${current.id}`,
          severity: 'warning',
          kind: 'transition-decision',
          ruleIds: ['MIG-REPLACE-001'],
          objectIds: [current.id, replacementRoleId],
          message: `${current.name} is marked for replacement by ${replacementRoleId}, but that role is not present in the composed target.`,
          nextDecision: 'Add the replacement role to target scope or revise the replacement strategy.'
        });
        continue;
      }
      coveredTargetRoles.add(replacementRoleId);
      if (!replacementMap.has(replacementRoleId)) replacementMap.set(replacementRoleId, []);
      replacementMap.get(replacementRoleId).push(current.id);
    }

    if (current.strategy === 'retire' && targetRoleIds.has(current.roleId) && !current.replacementRoleId) {
      findings.push({
        id: `transition.retire-required-role.${current.id}`,
        severity: 'warning',
        kind: 'transition-decision',
        ruleIds: ['MIG-REPLACE-001'],
        objectIds: [current.id, current.roleId],
        message: `${current.name} is marked for retirement while ${current.roleId} remains required in the target architecture.`,
        nextDecision: 'Define a replacement application instance or change the target role requirement before retirement.'
      });
    }

    if (current.strategy === 'keep' && !targetRoleIds.has(current.roleId)) {
      findings.push({
        id: `transition.keep-outside-target.${current.id}`,
        severity: 'warning',
        kind: 'transition-decision',
        ruleIds: ['QUALITY-SYSTEM-JUSTIFICATION-001'],
        objectIds: [current.id, current.roleId],
        message: `${current.name} is explicitly kept although its role is not required by the composed target scope.`,
        nextDecision: 'Document the out-of-scope reason for retention or retire the application when dependencies allow.'
      });
    }

    if (current.strategy === 'undecided') {
      findings.push({
        id: `transition.strategy-undecided.${current.id}`,
        severity: 'warning',
        kind: 'transition-decision',
        ruleIds: ['MIG-REPLACE-001'],
        objectIds: [current.id, current.roleId],
        message: `${current.name} has no migration strategy.`,
        nextDecision: 'Choose keep, replace or retire before creating a migration roadmap.'
      });
    }
  }

  for (const roleId of [...targetRoleIds].sort()) {
    if (coveredTargetRoles.has(roleId)) {
      const replaced = replacementMap.get(roleId) ?? [];
      if (replaced.length) systemRecords.push(targetSystemRecord(roleId, replaced));
      continue;
    }
    systemRecords.push(targetSystemRecord(roleId));
  }

  for (const [roleId, currentIds] of [...replacementMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const targetId = targetSystemId(roleId);
    for (const currentId of currentIds.sort()) {
      replacements.push({
        id: `replacement.${currentId}.${targetId}`,
        kind: 'system-replacement',
        currentId,
        targetId,
        roleId,
        ruleIds: ['MIG-REPLACE-001']
      });
      dependencies.push({
        id: `dependency.introduce-before-retire.${currentId}`,
        before: targetId,
        after: currentId,
        relation: 'introduce-before-retire',
        ruleIds: ['MIG-REPLACE-001']
      });
      coexistenceWindows.push({
        id: `coexistence.${currentId}.${targetId}`,
        currentId,
        targetId,
        reason: 'Replacement requires a bounded coexistence period for migration, verification and rollback readiness.'
      });
      const introduceId = `wp.transition.introduce.${targetId}`;
      const coexistId = `wp.transition.coexist.${currentId}.${targetId}`;
      const retireId = `wp.transition.retire.${currentId}`;
      workPackages.push(
        {
          id: introduceId,
          phase: 'foundation',
          title: `Introduce ${targetId}`,
          mandatory: true,
          dependsOn: ['wp.architecture.resolve-decisions'],
          sourceIds: [targetId, currentId]
        },
        {
          id: coexistId,
          phase: 'cutover',
          title: `Run bounded coexistence for ${currentId} and ${targetId}`,
          mandatory: true,
          dependsOn: [introduceId],
          sourceIds: [currentId, targetId]
        },
        {
          id: retireId,
          phase: 'cutover',
          title: `Retire ${currentId} after replacement verification`,
          mandatory: true,
          dependsOn: [coexistId],
          sourceIds: [currentId, targetId]
        }
      );
    }
  }

  for (const current of currentSystems.filter((item) => item.strategy === 'retire' && !targetRoleIds.has(item.roleId))) {
    workPackages.push({
      id: `wp.transition.retire.${current.id}`,
      phase: 'cutover',
      title: `Retire ${current.name}`,
      mandatory: true,
      dependsOn: ['wp.architecture.resolve-decisions'],
      sourceIds: [current.id, current.roleId]
    });
  }

  const currentIntegrationRecords = currentIntegrations.map((item) => currentIntegrationRecord(item, targetIntegrationIds));
  const coveredTargetIntegrations = new Set(currentIntegrations
    .filter((item) => item.strategy === 'keep' && item.targetIntegrationId && targetIntegrationIds.has(item.targetIntegrationId))
    .map((item) => item.targetIntegrationId));
  const integrationReplacements = [];

  for (const current of currentIntegrations) {
    if (current.strategy === 'replace' && current.targetIntegrationId && targetIntegrationIds.has(current.targetIntegrationId)) {
      integrationReplacements.push({
        id: `replacement.${current.id}.${targetIntegrationInstanceId(current.targetIntegrationId)}`,
        kind: 'integration-replacement',
        currentId: current.id,
        targetId: targetIntegrationInstanceId(current.targetIntegrationId),
        targetIntegrationId: current.targetIntegrationId,
        ruleIds: ['MIG-REPLACE-001']
      });
    } else if (current.strategy === 'replace' && !current.targetIntegrationId) {
      findings.push({
        id: `transition.integration-replacement-target.${current.id}`,
        severity: 'warning',
        kind: 'transition-decision',
        ruleIds: ['MIG-REPLACE-001'],
        objectIds: [current.id],
        message: `${current.name} is marked for replacement but no targetIntegrationId is defined.`,
        nextDecision: 'Map the current integration to a composed target integration before planning replacement.'
      });
    } else if (current.strategy === 'undecided') {
      findings.push({
        id: `transition.integration-strategy.${current.id}`,
        severity: 'warning',
        kind: 'transition-decision',
        ruleIds: ['MIG-REPLACE-001'],
        objectIds: [current.id],
        message: `${current.name} has no integration migration strategy.`,
        nextDecision: 'Choose keep, replace or retire and map it to target integration scope if applicable.'
      });
    }
  }

  const targetIntegrationRecords = result.blueprint.integrations.map((integration) => ({
    id: targetIntegrationInstanceId(integration.id),
    name: integration.name,
    kind: 'integration-instance',
    targetIntegrationId: integration.id,
    sourceRoleId: integration.source,
    targetRoleId: integration.target,
    states: coveredTargetIntegrations.has(integration.id) ? ['target'] : ['transition', 'target'],
    intent: coveredTargetIntegrations.has(integration.id) ? 'covered-by-current' : 'introduce-or-confirm',
    source: 'composed-target-integration'
  }));

  return {
    schemaVersion: '0.1',
    systems: [...systemRecords].sort((a, b) => a.id.localeCompare(b.id)),
    integrations: [...currentIntegrationRecords, ...targetIntegrationRecords].sort((a, b) => a.id.localeCompare(b.id)),
    replacements: [...replacements, ...integrationReplacements].sort((a, b) => a.id.localeCompare(b.id)),
    dependencies: dependencies.sort((a, b) => a.id.localeCompare(b.id)),
    coexistenceWindows: coexistenceWindows.sort((a, b) => a.id.localeCompare(b.id)),
    findings: findings.sort((a, b) => a.id.localeCompare(b.id)),
    workPackages: [...new Map(workPackages.map((item) => [item.id, item])).values()].sort((a, b) => a.id.localeCompare(b.id))
  };
}
