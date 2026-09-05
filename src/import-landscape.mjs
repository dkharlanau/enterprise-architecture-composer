import { processes } from './catalog.mjs';
import { resolveGlossaryAlias } from './glossary.mjs';

const STRATEGIES = new Set(['keep', 'replace', 'retire', 'undecided']);

function sortedUnique(values = []) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function slug(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseCsvRecords(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const input = String(text ?? '').replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field.trim());
      field = '';
    } else if (char === '\n') {
      row.push(field.trim());
      field = '';
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
    } else if (char !== '\r') field += char;
  }
  row.push(field.trim());
  if (row.some((value) => value !== '')) rows.push(row);
  if (!rows.length) return [];

  const headers = rows[0].map((value) => value.trim().toLowerCase());
  return rows.slice(1).map((values, index) => ({
    __row: index + 2,
    ...Object.fromEntries(headers.map((header, column) => [header, values[column] ?? '']))
  }));
}

function resolveSystemRole(value) {
  if (!value) return { status: 'unknown', alias: '', candidates: [] };
  return resolveGlossaryAlias(value, { kind: 'system-role' });
}

function roleConflict(sourceId, row, value, resolution) {
  return {
    id: `import.role.${slug(sourceId)}.${row}`,
    kind: 'role-resolution',
    severity: 'warning',
    sourceId,
    row,
    value,
    status: resolution.status,
    candidates: resolution.candidates ?? [],
    message: resolution.status === 'ambiguous'
      ? `System role '${value}' is ambiguous and was not imported automatically.`
      : `System role '${value}' is unknown to the Composer glossary.`
  };
}

function normalizeStrategy(value) {
  const strategy = String(value || 'undecided').trim().toLowerCase();
  return STRATEGIES.has(strategy) ? strategy : null;
}

export function importApplicationInventoryCsv(text, options = {}) {
  const sourceId = options.sourceId ?? 'csv:applications';
  const systems = [];
  const facts = [];
  const conflicts = [];

  for (const row of parseCsvRecords(text)) {
    const id = row.id || row.application_id || row.system_id;
    const name = row.name || row.application_name || row.system_name || id;
    const roleValue = row.role_id || row.role || row.system_role;
    if (!id || !name) {
      conflicts.push({
        id: `import.application.required.${row.__row}`,
        kind: 'required-field', severity: 'error', sourceId, row: row.__row,
        message: 'Application inventory row requires id and name.'
      });
      continue;
    }

    const resolution = resolveSystemRole(roleValue);
    if (resolution.status !== 'resolved') {
      conflicts.push(roleConflict(sourceId, row.__row, roleValue, resolution));
      continue;
    }
    const strategy = normalizeStrategy(row.strategy);
    if (!strategy) {
      conflicts.push({
        id: `import.application.strategy.${slug(id)}`,
        kind: 'invalid-strategy', severity: 'warning', sourceId, row: row.__row,
        value: row.strategy,
        message: `Invalid migration strategy '${row.strategy}' for ${id}; expected keep, replace, retire or undecided.`
      });
      continue;
    }
    const replacement = row.replacement_role_id || row.replacement_role;
    const replacementResolution = replacement ? resolveSystemRole(replacement) : null;
    if (replacementResolution && replacementResolution.status !== 'resolved') {
      conflicts.push(roleConflict(sourceId, row.__row, replacement, replacementResolution));
      continue;
    }

    systems.push({
      id,
      name,
      roleId: resolution.id,
      strategy,
      ...(replacementResolution?.id ? { replacementRoleId: replacementResolution.id } : {}),
      ...(row.notes ? { notes: row.notes } : {})
    });
    facts.push({
      id: `fact.application.${slug(id)}`,
      kind: 'current-application',
      subjectId: id,
      value: { name, roleId: resolution.id, strategy },
      provenance: { sourceType: 'csv', sourceId, row: row.__row }
    });
  }

  return {
    schemaVersion: '0.1', sourceId,
    currentLandscape: { systems: systems.sort((a, b) => a.id.localeCompare(b.id)), integrations: [] },
    processes: [], facts: facts.sort((a, b) => a.id.localeCompare(b.id)), conflicts
  };
}

export function importInterfaceInventoryCsv(text, options = {}) {
  const sourceId = options.sourceId ?? 'csv:interfaces';
  const integrations = [];
  const facts = [];
  const conflicts = [];

  for (const row of parseCsvRecords(text)) {
    const id = row.id || row.interface_id;
    const name = row.name || row.interface_name || id;
    const sourceSystemId = row.source_system_id || row.source;
    const targetSystemId = row.target_system_id || row.target;
    if (!id || !name || !sourceSystemId || !targetSystemId) {
      conflicts.push({
        id: `import.interface.required.${row.__row}`,
        kind: 'required-field', severity: 'error', sourceId, row: row.__row,
        message: 'Interface inventory row requires id, name, source_system_id and target_system_id.'
      });
      continue;
    }
    const strategy = normalizeStrategy(row.strategy);
    if (!strategy) {
      conflicts.push({
        id: `import.interface.strategy.${slug(id)}`,
        kind: 'invalid-strategy', severity: 'warning', sourceId, row: row.__row,
        message: `Invalid migration strategy '${row.strategy}' for ${id}.`
      });
      continue;
    }
    integrations.push({
      id, name, sourceSystemId, targetSystemId, strategy,
      ...(row.target_integration_id ? { targetIntegrationId: row.target_integration_id } : {}),
      ...(row.notes ? { notes: row.notes } : {})
    });
    facts.push({
      id: `fact.interface.${slug(id)}`,
      kind: 'current-interface', subjectId: id,
      value: { sourceSystemId, targetSystemId, strategy, targetIntegrationId: row.target_integration_id || null },
      provenance: { sourceType: 'csv', sourceId, row: row.__row }
    });
  }

  return {
    schemaVersion: '0.1', sourceId,
    currentLandscape: { systems: [], integrations: integrations.sort((a, b) => a.id.localeCompare(b.id)) },
    processes: [], facts: facts.sort((a, b) => a.id.localeCompare(b.id)), conflicts
  };
}

function backstageRef(entity) {
  const kind = String(entity.kind ?? 'Unknown').toLowerCase();
  const namespace = entity.metadata?.namespace ?? 'default';
  const name = entity.metadata?.name ?? 'unknown';
  return `${kind}:${namespace}/${name}`;
}

export function importBackstageEntities(entities = [], options = {}) {
  const sourceId = options.sourceId ?? 'backstage:catalog';
  const systems = [];
  const facts = [];
  const conflicts = [];

  for (const entity of entities) {
    if (!['System', 'Component'].includes(entity.kind)) continue;
    const ref = backstageRef(entity);
    const annotations = entity.metadata?.annotations ?? {};
    const roleValue = annotations['eac.io/role-id'] || annotations['eac.io/role'];
    const resolution = resolveSystemRole(roleValue);
    if (resolution.status !== 'resolved') {
      conflicts.push({
        id: `import.backstage.role.${slug(ref)}`,
        kind: 'role-resolution', severity: 'warning', sourceId, entityRef: ref,
        value: roleValue ?? null, status: resolution.status, candidates: resolution.candidates ?? [],
        message: roleValue
          ? `Backstage entity ${ref} has unresolved Composer role '${roleValue}'.`
          : `Backstage entity ${ref} needs explicit eac.io/role-id or eac.io/role annotation before it can become a Composer current application.`
      });
      continue;
    }
    const strategy = normalizeStrategy(annotations['eac.io/strategy']) ?? 'undecided';
    const id = annotations['eac.io/instance-id'] || `app.backstage.${slug(entity.metadata?.name)}`;
    const name = entity.metadata?.title || entity.metadata?.name || id;
    systems.push({ id, name, roleId: resolution.id, strategy });
    facts.push({
      id: `fact.backstage.${slug(ref)}`,
      kind: 'current-application', subjectId: id,
      value: { roleId: resolution.id, strategy },
      provenance: { sourceType: 'backstage', sourceId, entityRef: ref }
    });
  }

  return {
    schemaVersion: '0.1', sourceId,
    currentLandscape: { systems: systems.sort((a, b) => a.id.localeCompare(b.id)), integrations: [] },
    processes: [], facts: facts.sort((a, b) => a.id.localeCompare(b.id)), conflicts
  };
}

export function importProcessAsCode(document, options = {}) {
  const sourceId = options.sourceId ?? 'process-as-code:artifact';
  const processValue = document?.process?.id || document?.process?.name;
  const resolution = resolveGlossaryAlias(processValue, { kind: 'process' });
  const facts = [];
  const conflicts = [];
  const processKeys = [];

  if (resolution.status === 'resolved') {
    const process = processes.find((item) => item.id === resolution.id);
    if (process) processKeys.push(process.key);
    facts.push({
      id: `fact.process.${slug(resolution.id)}`,
      kind: 'process-scope', subjectId: resolution.id,
      value: { contractVersion: document.version ?? null },
      provenance: { sourceType: 'process-as-code', sourceId, processId: document.process.id }
    });
  } else {
    conflicts.push({
      id: `import.process.scope.${slug(processValue)}`,
      kind: 'process-resolution', severity: 'warning', sourceId,
      value: processValue, status: resolution.status, candidates: resolution.candidates ?? [],
      message: `Process-as-Code artifact '${processValue}' does not map unambiguously to the Composer reference process catalog.`
    });
  }

  for (const system of document?.systems ?? []) {
    facts.push({
      id: `fact.process-system.${slug(system.id)}`,
      kind: 'declared-logical-system', subjectId: system.id,
      value: { name: system.name ?? null },
      provenance: { sourceType: 'process-as-code', sourceId, processId: document?.process?.id ?? null }
    });
  }

  return {
    schemaVersion: '0.1', sourceId,
    currentLandscape: { systems: [], integrations: [] },
    processes: sortedUnique(processKeys), facts: facts.sort((a, b) => a.id.localeCompare(b.id)), conflicts
  };
}

export function importInterfaceAsCode(document, options = {}) {
  const sourceId = options.sourceId ?? 'interface-as-code:artifact';
  const iface = document?.interface ?? {};
  const facts = [];
  const conflicts = [];

  for (const [side, endpoint] of [['source', iface.source], ['target', iface.target]]) {
    const value = endpoint?.system;
    const resolution = resolveSystemRole(value);
    facts.push({
      id: `fact.interface-contract.${slug(iface.id)}.${side}`,
      kind: 'logical-interface-endpoint', subjectId: iface.id,
      value: { side, system: value ?? null, roleId: resolution.status === 'resolved' ? resolution.id : null },
      provenance: { sourceType: 'interface-as-code', sourceId, interfaceId: iface.id ?? null }
    });
    if (value && resolution.status !== 'resolved') {
      conflicts.push({
        id: `import.interface-contract.role.${slug(iface.id)}.${side}`,
        kind: 'role-resolution', severity: 'warning', sourceId,
        value, status: resolution.status, candidates: resolution.candidates ?? [],
        message: `Interface-as-Code ${side} system '${value}' is not an unambiguous Composer system role. It remains evidence only.`
      });
    }
  }

  facts.push({
    id: `fact.interface-contract.${slug(iface.id)}.contract`,
    kind: 'operational-interface-contract', subjectId: iface.id,
    value: {
      mode: iface.mode ?? null,
      pattern: iface.pattern ?? null,
      contractFormat: document?.contract?.format ?? null,
      lifecycle: iface.lifecycle ?? null
    },
    provenance: { sourceType: 'interface-as-code', sourceId, interfaceId: iface.id ?? null }
  });

  return {
    schemaVersion: '0.1', sourceId,
    currentLandscape: { systems: [], integrations: [] },
    processes: [], facts: facts.sort((a, b) => a.id.localeCompare(b.id)), conflicts
  };
}

function mergeById(baseItems, incomingItems, kind, conflicts, sourceId) {
  const index = new Map(baseItems.map((item) => [item.id, structuredClone(item)]));
  for (const incoming of incomingItems) {
    const existing = index.get(incoming.id);
    if (!existing) {
      index.set(incoming.id, structuredClone(incoming));
      continue;
    }
    if (JSON.stringify(existing) !== JSON.stringify(incoming)) {
      conflicts.push({
        id: `import.merge.${kind}.${slug(incoming.id)}`,
        kind: 'merge-conflict', severity: 'warning', sourceId,
        subjectId: incoming.id,
        existing, incoming,
        message: `${kind} ${incoming.id} already exists with different facts; existing context was preserved.`
      });
    }
  }
  return [...index.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function mergeImportedConstraints(baseContext = {}, imports = []) {
  const conflicts = imports.flatMap((item) => item.conflicts ?? []).map((item) => structuredClone(item));
  const evidence = imports.flatMap((item) => item.facts ?? []).map((item) => structuredClone(item)).sort((a, b) => a.id.localeCompare(b.id));
  const processesOut = sortedUnique([...(baseContext.processes ?? []), ...imports.flatMap((item) => item.processes ?? [])]);
  let systemsOut = structuredClone(baseContext.currentLandscape?.systems ?? []);
  let integrationsOut = structuredClone(baseContext.currentLandscape?.integrations ?? []);

  for (const imported of imports) {
    systemsOut = mergeById(systemsOut, imported.currentLandscape?.systems ?? [], 'system', conflicts, imported.sourceId);
    integrationsOut = mergeById(integrationsOut, imported.currentLandscape?.integrations ?? [], 'integration', conflicts, imported.sourceId);
  }

  const systemIds = new Set(systemsOut.map((item) => item.id));
  for (const integration of integrationsOut) {
    for (const endpointId of [integration.sourceSystemId, integration.targetSystemId]) {
      if (!systemIds.has(endpointId)) {
        conflicts.push({
          id: `import.merge.interface-endpoint.${slug(integration.id)}.${slug(endpointId)}`,
          kind: 'missing-current-system', severity: 'warning',
          subjectId: integration.id,
          message: `Current integration ${integration.id} references ${endpointId}, which is not present in the merged current application inventory.`
        });
      }
    }
  }

  return {
    schemaVersion: '0.1',
    context: {
      ...structuredClone(baseContext),
      processes: processesOut,
      ...(systemsOut.length || integrationsOut.length ? {
        currentLandscape: { systems: systemsOut, integrations: integrationsOut }
      } : {})
    },
    evidence,
    conflicts: [...new Map(conflicts.map((item) => [item.id, item])).values()].sort((a, b) => a.id.localeCompare(b.id))
  };
}
