import { decideIntegrationPattern } from './integration-decision.mjs';
import { ruleById } from './rulebook.mjs';

export const DECISION_TABLE_COMPATIBILITY_TARGET = {
  product: 'decision-tables-as-code',
  version: 1,
  repository: 'https://github.com/dkharlanau/decision-tables-as-code',
  schema: 'https://dkharlanau.github.io/decision-tables-as-code/schema/decision-table.schema.json'
};

const ALLOWED_TOP_LEVEL = new Set(['version', 'id', 'name', 'description', 'hit_policy', 'metadata', 'inputs', 'outputs', 'rules']);
const ALLOWED_INPUT = new Set(['name', 'type', 'description', 'domain']);
const ALLOWED_OUTPUT = new Set(['name', 'type', 'description']);
const ALLOWED_RULE = new Set(['id', 'description', 'priority', 'owner', 'source', 'ticket', 'rationale', 'effective_from', 'effective_to', 'metadata', 'when', 'then']);

function duplicateValues(values = []) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort((a, b) => String(a).localeCompare(String(b)));
}

function unknownFields(record, allowed) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return [];
  return Object.keys(record).filter((key) => !allowed.has(key)).sort();
}

export function validateDecisionTableCompatibilityShape(table) {
  const errors = [];
  if (table?.version !== 1) errors.push('version must be 1.');
  if (!table?.id) errors.push('id is required.');
  if (!['unique', 'first', 'collect'].includes(table?.hit_policy)) errors.push('hit_policy must be unique, first or collect.');
  if (!Array.isArray(table?.inputs)) errors.push('inputs must be an array.');
  if (!Array.isArray(table?.outputs)) errors.push('outputs must be an array.');
  if (!Array.isArray(table?.rules)) errors.push('rules must be an array.');
  for (const key of unknownFields(table, ALLOWED_TOP_LEVEL)) errors.push(`unsupported top-level field '${key}'.`);

  for (const [index, input] of (table?.inputs ?? []).entries()) {
    if (!input.name) errors.push(`inputs[${index}].name is required.`);
    for (const key of unknownFields(input, ALLOWED_INPUT)) errors.push(`inputs[${index}] contains unsupported field '${key}'.`);
  }
  for (const [index, output] of (table?.outputs ?? []).entries()) {
    if (!output.name) errors.push(`outputs[${index}].name is required.`);
    for (const key of unknownFields(output, ALLOWED_OUTPUT)) errors.push(`outputs[${index}] contains unsupported field '${key}'.`);
  }
  for (const [index, rule] of (table?.rules ?? []).entries()) {
    if (!rule.id) errors.push(`rules[${index}].id is required.`);
    if (!rule.when || typeof rule.when !== 'object') errors.push(`rules[${index}].when is required.`);
    if (!rule.then || typeof rule.then !== 'object') errors.push(`rules[${index}].then is required.`);
    for (const key of unknownFields(rule, ALLOWED_RULE)) errors.push(`rules[${index}] contains unsupported field '${key}'.`);
    if (rule.source && !ruleById(rule.source)) errors.push(`rules[${index}] references unknown Composer rule ${rule.source}.`);
  }
  for (const duplicate of duplicateValues((table?.inputs ?? []).map((item) => item.name))) errors.push(`duplicate input ${duplicate}.`);
  for (const duplicate of duplicateValues((table?.outputs ?? []).map((item) => item.name))) errors.push(`duplicate output ${duplicate}.`);
  for (const duplicate of duplicateValues((table?.rules ?? []).map((item) => item.id))) errors.push(`duplicate rule ${duplicate}.`);

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)].sort(),
    compatibilityTarget: DECISION_TABLE_COMPATIBILITY_TARGET
  };
}

function mapById(items = []) {
  return new Map(items.map((item) => [item.id, item]));
}

export function compareNativeIntegrationDecisions(table, vectorsDocument) {
  const shape = validateDecisionTableCompatibilityShape(table);
  const errors = [...shape.errors];
  if (vectorsDocument?.tableId !== table?.id) errors.push(`vectors tableId ${vectorsDocument?.tableId ?? '<missing>'} does not match ${table?.id ?? '<missing>'}.`);
  if (vectorsDocument?.runtimeOwner !== DECISION_TABLE_COMPATIBILITY_TARGET.repository) {
    errors.push('vectors runtimeOwner must remain decision-tables-as-code.');
  }
  const rules = mapById(table?.rules ?? []);
  const vectors = [];

  for (const vector of vectorsDocument?.vectors ?? []) {
    const rule = rules.get(vector.ruleId);
    const tablePatternId = rule?.then?.pattern_id ?? null;
    const native = decideIntegrationPattern(vector.input ?? {});
    const nativePatternId = native.selected?.patternId ?? null;
    const matches = Boolean(rule) && tablePatternId === nativePatternId;
    if (!rule) errors.push(`Vector ${vector.id} references missing table rule ${vector.ruleId}.`);
    vectors.push({
      id: vector.id,
      ruleId: vector.ruleId,
      tableInput: structuredClone(vector.tableInput ?? {}),
      nativeInput: structuredClone(vector.input ?? {}),
      tablePatternId,
      nativePatternId,
      matches,
      nativeRuleIds: native.selected?.ruleIds ?? []
    });
  }

  const mismatches = vectors.filter((item) => !item.matches);
  return {
    format: 'enterprise-architecture-composer/decision-table-compatibility-report',
    formatVersion: '0.1',
    tableId: table?.id ?? null,
    compatibilityTarget: DECISION_TABLE_COMPATIBILITY_TARGET,
    runtimeOwnership: {
      owner: 'decision-tables-as-code',
      composerRole: 'orchestration-and-native-equivalence-fixtures',
      evaluatorImplementedInComposer: false
    },
    shapeValid: shape.valid,
    deterministicNativeEquivalence: errors.length === 0 && mismatches.length === 0,
    vectors,
    mismatches,
    errors: [...new Set(errors)].sort(),
    readability: {
      inputCount: table?.inputs?.length ?? 0,
      outputCount: table?.outputs?.length ?? 0,
      ruleCount: table?.rules?.length ?? 0,
      hitPolicy: table?.hit_policy ?? null,
      ruleIds: (table?.rules ?? []).map((item) => item.id),
      composerRuleReferences: [...new Set((table?.rules ?? []).map((item) => item.source).filter(Boolean))].sort()
    }
  };
}

export function decisionTableCompatibilitySummary(report) {
  return {
    tableId: report.tableId,
    schemaTarget: report.compatibilityTarget.schema,
    shapeValid: report.shapeValid,
    nativeVectorCount: report.vectors.length,
    nativeMatchCount: report.vectors.filter((item) => item.matches).length,
    mismatchCount: report.mismatches.length,
    deterministicNativeEquivalence: report.deterministicNativeEquivalence,
    evaluatorImplementedInComposer: report.runtimeOwnership.evaluatorImplementedInComposer,
    ruleCount: report.readability.ruleCount,
    inputCount: report.readability.inputCount
  };
}
