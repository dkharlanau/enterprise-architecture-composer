import { composeArchitecture } from './composer.mjs';
import { buildGlossary, glossaryEntryById, resolveGlossaryAlias } from './glossary.mjs';

export const ARCHITECTURE_PACK_FORMAT = 'enterprise-architecture-composer/architecture-pack';
export const ARCHITECTURE_PACK_FORMAT_VERSION = '0.1';

const PACK_ID = /^pack\.(industry|vendor)\.[a-z0-9][a-z0-9.-]*$/;
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const EVIDENCE_TYPES = new Set(['standard', 'vendor-docs', 'internal-methodology', 'heuristic']);
const GUIDANCE_CLASSES = new Set(['fact', 'heuristic', 'vendor-mapping']);
const OPTION_TYPES = new Set(['system-role', 'integration-pattern', 'capability']);
const PREFERENCE_TYPES = new Set(['none', 'owner-preference', 'commercial']);

function normalizedAlias(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\/_.-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function duplicateValues(values = []) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort((a, b) => String(a).localeCompare(String(b)));
}

function namespaced(packId, id) {
  return typeof id === 'string' && id.startsWith(`${packId}.`);
}

function evidenceIndex(pack) {
  return new Map((pack.evidence ?? []).map((item) => [item.id, item]));
}

function recordIds(pack) {
  return [
    ...(pack.evidence ?? []).map((item) => item.id),
    ...(pack.aliases ?? []).map((item) => item.id),
    ...(pack.guidance ?? []).map((item) => item.id),
    ...(pack.options ?? []).map((item) => item.id)
  ];
}

function validateSourceIds(record, evidence, errors, label) {
  if (!Array.isArray(record.sourceIds) || !record.sourceIds.length) {
    errors.push(`${label} requires at least one sourceId.`);
    return;
  }
  for (const sourceId of record.sourceIds) {
    if (!evidence.has(sourceId)) errors.push(`${label} references missing evidence ${sourceId}.`);
  }
}

function validateFitEvidence(option, evidence, errors) {
  if (!Array.isArray(option.fitEvidence) || !option.fitEvidence.length) {
    errors.push(`Option ${option.id ?? '<missing>'} requires fitEvidence.`);
    return;
  }
  for (const [index, item] of option.fitEvidence.entries()) {
    if (!item?.statement || String(item.statement).trim().length < 10) {
      errors.push(`Option ${option.id} fitEvidence[${index}] requires a substantive statement.`);
    }
    validateSourceIds(item ?? {}, evidence, errors, `Option ${option.id} fitEvidence[${index}]`);
  }
}

function coreTargetExists(id, glossary) {
  return Boolean(glossaryEntryById(id, glossary));
}

export function validateArchitecturePack(pack, options = {}) {
  const glossary = options.glossary ?? buildGlossary();
  const errors = [];
  const warnings = [];
  const packId = pack?.pack?.id;

  if (pack?.format !== ARCHITECTURE_PACK_FORMAT) errors.push(`format must be ${ARCHITECTURE_PACK_FORMAT}.`);
  if (pack?.formatVersion !== ARCHITECTURE_PACK_FORMAT_VERSION) errors.push(`formatVersion must be ${ARCHITECTURE_PACK_FORMAT_VERSION}.`);
  if (!PACK_ID.test(String(packId ?? ''))) errors.push('pack.id must use pack.industry.* or pack.vendor.* namespace.');
  if (!SEMVER.test(String(pack?.pack?.version ?? ''))) errors.push('pack.version must be semantic x.y.z.');
  if (!['industry', 'vendor'].includes(pack?.pack?.kind)) errors.push('pack.kind must be industry or vendor.');
  if (packId && pack?.pack?.kind && !packId.startsWith(`pack.${pack.pack.kind}.`)) {
    errors.push(`pack.id namespace does not match kind ${pack.pack.kind}.`);
  }
  if (!pack?.pack?.name || String(pack.pack.name).trim().length < 3) errors.push('pack.name is required.');
  if (!pack?.pack?.description || String(pack.pack.description).trim().length < 20) errors.push('pack.description must explain the pack boundary.');

  for (const field of ['evidence', 'aliases', 'guidance', 'options']) {
    if (!Array.isArray(pack?.[field])) errors.push(`${field} must be an array.`);
  }
  if (Object.hasOwn(pack ?? {}, 'rules')) {
    errors.push('Architecture packs cannot define or replace core rules. Put advisory statements in guidance instead.');
  }

  const ids = recordIds(pack ?? {});
  for (const duplicate of duplicateValues(ids)) errors.push(`Duplicate pack record ID: ${duplicate}.`);
  for (const id of ids) {
    if (!id) errors.push('Every pack record requires an ID.');
    else if (packId && !namespaced(packId, id)) errors.push(`Pack record ${id} must be namespaced under ${packId}.`);
  }

  const evidence = evidenceIndex(pack ?? {});
  for (const item of pack?.evidence ?? []) {
    if (!EVIDENCE_TYPES.has(item.evidenceType)) errors.push(`Evidence ${item.id} has unsupported evidenceType ${item.evidenceType}.`);
    if (!item.title) errors.push(`Evidence ${item.id} requires a title.`);
    if (!item.note || String(item.note).trim().length < 10) errors.push(`Evidence ${item.id} requires a boundary note.`);
  }

  for (const alias of pack?.aliases ?? []) {
    if (!alias.alias) errors.push(`Alias ${alias.id} requires alias text.`);
    if (!coreTargetExists(alias.targetId, glossary)) errors.push(`Alias ${alias.id} references unknown core target ${alias.targetId}.`);
    const resolution = resolveGlossaryAlias(alias.alias, {}, glossary);
    if (resolution.status === 'resolved' && resolution.id !== alias.targetId) {
      errors.push(`Alias '${alias.alias}' already resolves to ${resolution.id}; pack cannot remap it to ${alias.targetId}.`);
    } else if (resolution.status === 'ambiguous') {
      errors.push(`Alias '${alias.alias}' is already ambiguous in the core glossary and cannot be added by a pack.`);
    }
  }

  for (const guidance of pack?.guidance ?? []) {
    if (!GUIDANCE_CLASSES.has(guidance.classification)) errors.push(`Guidance ${guidance.id} has invalid classification ${guidance.classification}.`);
    if (!guidance.statement || String(guidance.statement).trim().length < 20) errors.push(`Guidance ${guidance.id} requires a substantive statement.`);
    if (!Array.isArray(guidance.targetIds) || !guidance.targetIds.length) errors.push(`Guidance ${guidance.id} requires targetIds.`);
    for (const targetId of guidance.targetIds ?? []) {
      if (!coreTargetExists(targetId, glossary)) errors.push(`Guidance ${guidance.id} references unknown core target ${targetId}.`);
    }
    validateSourceIds(guidance, evidence, errors, `Guidance ${guidance.id}`);
    if (guidance.classification === 'fact') {
      const sourceTypes = (guidance.sourceIds ?? []).map((id) => evidence.get(id)?.evidenceType).filter(Boolean);
      if (!sourceTypes.some((type) => type === 'standard' || type === 'vendor-docs')) {
        errors.push(`Guidance ${guidance.id} is classified as fact but has no standard or vendor-docs evidence.`);
      }
    }
    if (guidance.classification === 'vendor-mapping' && pack?.pack?.kind !== 'vendor') {
      errors.push(`Guidance ${guidance.id} is vendor-mapping but pack.kind is not vendor.`);
    }
  }

  for (const option of pack?.options ?? []) {
    if (!OPTION_TYPES.has(option.optionType)) errors.push(`Option ${option.id} has invalid optionType ${option.optionType}.`);
    if (!coreTargetExists(option.targetId, glossary)) errors.push(`Option ${option.id} references unknown core target ${option.targetId}.`);
    if (!option.name) errors.push(`Option ${option.id} requires a name.`);
    validateFitEvidence(option, evidence, errors);
    if (!PREFERENCE_TYPES.has(option.commercialPreference?.status)) {
      errors.push(`Option ${option.id} requires commercialPreference.status separate from fitEvidence.`);
    }
    if (option.commercialPreference?.status !== 'none' && !option.commercialPreference?.rationale) {
      errors.push(`Option ${option.id} commercial preference requires rationale.`);
    }
    if (pack?.pack?.kind === 'vendor' && !option.vendor) errors.push(`Vendor pack option ${option.id} requires vendor.`);
    if (pack?.pack?.kind === 'industry' && option.vendor) warnings.push(`Industry option ${option.id} names vendor ${option.vendor}; consider moving it to a vendor pack.`);
  }

  return {
    valid: errors.length === 0,
    packId: packId ?? null,
    recordCount: ids.length,
    errors: [...new Set(errors)].sort(),
    warnings: [...new Set(warnings)].sort()
  };
}

export function validateArchitecturePackSet(packs = [], options = {}) {
  const glossary = options.glossary ?? buildGlossary();
  const validations = packs.map((pack) => validateArchitecturePack(pack, { glossary }));
  const errors = validations.flatMap((item) => item.errors.map((error) => `${item.packId ?? '<unknown-pack>'}: ${error}`));
  const warnings = validations.flatMap((item) => item.warnings.map((warning) => `${item.packId ?? '<unknown-pack>'}: ${warning}`));

  for (const duplicate of duplicateValues(packs.map((pack) => pack?.pack?.id).filter(Boolean))) {
    errors.push(`Duplicate pack ID: ${duplicate}.`);
  }
  const allRecordIds = packs.flatMap((pack) => recordIds(pack));
  for (const duplicate of duplicateValues(allRecordIds)) errors.push(`Duplicate record ID across packs: ${duplicate}.`);

  const aliasTargets = new Map();
  for (const pack of packs) {
    for (const alias of pack.aliases ?? []) {
      const normalized = normalizedAlias(alias.alias);
      if (!normalized) continue;
      const prior = aliasTargets.get(normalized);
      if (prior && prior.targetId !== alias.targetId) {
        errors.push(`Alias '${alias.alias}' maps to both ${prior.targetId} (${prior.packId}) and ${alias.targetId} (${pack.pack?.id}).`);
      } else if (!prior) {
        aliasTargets.set(normalized, { targetId: alias.targetId, packId: pack.pack?.id });
      }
    }
  }

  return {
    valid: errors.length === 0,
    packCount: packs.length,
    validations,
    errors: [...new Set(errors)].sort(),
    warnings: [...new Set(warnings)].sort()
  };
}

export function loadArchitecturePacks(packs = [], options = {}) {
  const validation = validateArchitecturePackSet(packs, options);
  if (!validation.valid) {
    throw new Error(`Invalid architecture pack set:\n- ${validation.errors.join('\n- ')}`);
  }
  return {
    schemaVersion: '0.1',
    packs: packs
      .map((pack) => structuredClone(pack))
      .sort((a, b) => a.pack.id.localeCompare(b.pack.id)),
    validation
  };
}

function activeBlueprintIds(result) {
  return new Set(Object.values(result.blueprint ?? {})
    .filter(Array.isArray)
    .flatMap((items) => items.map((item) => item.id)));
}

export function architecturePackOverlay(result, packs = []) {
  const loaded = loadArchitecturePacks(packs);
  const activeIds = activeBlueprintIds(result);
  const guidance = [];
  const options = [];
  const aliases = [];

  for (const pack of loaded.packs) {
    const evidence = new Map(pack.evidence.map((item) => [item.id, item]));
    for (const item of pack.guidance) {
      const matchedTargetIds = item.targetIds.filter((id) => activeIds.has(id)).sort();
      if (!matchedTargetIds.length) continue;
      guidance.push({
        ...structuredClone(item),
        packId: pack.pack.id,
        matchedTargetIds,
        evidence: item.sourceIds.map((id) => structuredClone(evidence.get(id))).filter(Boolean)
      });
    }
    for (const item of pack.options) {
      if (!activeIds.has(item.targetId)) continue;
      options.push({
        ...structuredClone(item),
        packId: pack.pack.id,
        evidence: [...new Set(item.fitEvidence.flatMap((entry) => entry.sourceIds))]
          .sort()
          .map((id) => structuredClone(evidence.get(id)))
          .filter(Boolean)
      });
    }
    for (const item of pack.aliases) {
      if (activeIds.has(item.targetId)) aliases.push({ ...structuredClone(item), packId: pack.pack.id });
    }
  }

  return {
    schemaVersion: '0.1',
    source: {
      engineVersion: result.engineVersion,
      catalogVersion: result.catalogVersion
    },
    packs: loaded.packs.map((pack) => ({
      id: pack.pack.id,
      version: pack.pack.version,
      kind: pack.pack.kind,
      name: pack.pack.name
    })),
    guidance: guidance.sort((a, b) => a.id.localeCompare(b.id)),
    options: options.sort((a, b) => a.id.localeCompare(b.id)),
    aliases: aliases.sort((a, b) => a.id.localeCompare(b.id))
  };
}

export function composeArchitectureWithPacks(input = {}, packs = []) {
  const composition = composeArchitecture(input);
  return {
    schemaVersion: '0.1',
    composition,
    packOverlay: architecturePackOverlay(composition, packs)
  };
}
