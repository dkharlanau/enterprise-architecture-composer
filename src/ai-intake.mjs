import { createHash } from 'node:crypto';

import { processes } from './catalog.mjs';
import { composeArchitecture } from './composer.mjs';

export const AI_INTAKE_FORMAT = 'enterprise-architecture-composer/ai-intake-proposal';
export const AI_INTAKE_FORMAT_VERSION = '0.1';

const PROCESS_KEYS = new Set(processes.map((item) => item.key));
const EXISTING_SYSTEM_KEYS = new Set(['crm', 'erp', 'mdm', 'wms', 'legacy-wms', 'mes', 'tms', 'integration', 'integration-platform', 'data-platform', 'partner-edge']);
const CONTEXT_FIELDS = new Set(['industry', 'operatingModel', 'processes', 'scale', 'constraints', 'existingSystems', 'requireExplicitNfrs', 'nfrProfile', 'integrationProfiles', 'securityProfile']);
const SCALE_FIELDS = new Set(['countries', 'legalEntities', 'plants', 'warehouses']);
const CONSTRAINT_FIELDS = new Set(['multiCompany', 'highVolume', 'retainLegacyWms']);
const NFR_FIELDS = new Set(['purpose', 'latency', 'consistency', 'volume', 'fanOut', 'ordering', 'replay', 'offlineTolerance', 'partnerBoundary', 'payloadSize', 'changeFrequency', 'immediateResponse']);
const NFR_ENUMS = {
  purpose: new Set(['business-request', 'state-transfer', 'business-event', 'partner-document', 'analytics', 'replication', 'command']),
  latency: new Set(['immediate', 'seconds', 'minutes', 'hours']),
  consistency: new Set(['strong', 'eventual', 'snapshot']),
  volume: new Set(['low', 'medium', 'high', 'very-high']),
  ordering: new Set(['none', 'per-key', 'global']),
  replay: new Set(['not-required', 'desirable', 'required']),
  offlineTolerance: new Set(['none', 'short', 'extended']),
  payloadSize: new Set(['small', 'medium', 'large', 'very-large']),
  changeFrequency: new Set(['low', 'medium', 'high'])
};

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(stableObject(value))).digest('hex');
}

function duplicateValues(values = []) {
  const seen = new Set();
  const duplicate = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return [...duplicate].sort();
}

function validateKnownFields(value, allowed, path, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${path}.${key} is not an AI-intake context field.`);
  }
}

function validateNfrProfile(profile, path, errors) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    errors.push(`${path} must be an object.`);
    return;
  }
  validateKnownFields(profile, NFR_FIELDS, path, errors);
  for (const [key, value] of Object.entries(profile)) {
    if (NFR_ENUMS[key] && !NFR_ENUMS[key].has(value)) errors.push(`${path}.${key} has unsupported value ${value}.`);
    if (key === 'fanOut' && (!Number.isInteger(value) || value < 1)) errors.push(`${path}.fanOut must be an integer >= 1.`);
    if (['partnerBoundary', 'immediateResponse'].includes(key) && typeof value !== 'boolean') errors.push(`${path}.${key} must be boolean.`);
  }
}

export function validateAiProposedContext(context) {
  const errors = [];
  if (!context || typeof context !== 'object' || Array.isArray(context)) return { valid: false, errors: ['proposedContext must be an object.'] };
  validateKnownFields(context, CONTEXT_FIELDS, 'proposedContext', errors);

  if (!Array.isArray(context.processes) || !context.processes.length) errors.push('proposedContext.processes requires at least one process.');
  for (const process of context.processes ?? []) {
    if (!PROCESS_KEYS.has(process)) errors.push(`Unknown process key: ${process}.`);
  }
  for (const duplicate of duplicateValues(context.processes ?? [])) errors.push(`Duplicate process key: ${duplicate}.`);

  if (context.scale !== undefined) {
    if (!context.scale || typeof context.scale !== 'object' || Array.isArray(context.scale)) errors.push('proposedContext.scale must be an object.');
    else {
      validateKnownFields(context.scale, SCALE_FIELDS, 'proposedContext.scale', errors);
      for (const [key, value] of Object.entries(context.scale)) {
        if (!Number.isInteger(value) || value < 1) errors.push(`proposedContext.scale.${key} must be an integer >= 1.`);
      }
    }
  }

  if (context.constraints !== undefined) {
    if (!context.constraints || typeof context.constraints !== 'object' || Array.isArray(context.constraints)) errors.push('proposedContext.constraints must be an object.');
    else {
      validateKnownFields(context.constraints, CONSTRAINT_FIELDS, 'proposedContext.constraints', errors);
      for (const [key, value] of Object.entries(context.constraints)) {
        if (typeof value !== 'boolean') errors.push(`proposedContext.constraints.${key} must be boolean.`);
      }
    }
  }

  if (context.existingSystems !== undefined) {
    if (!Array.isArray(context.existingSystems)) errors.push('proposedContext.existingSystems must be an array.');
    else for (const value of context.existingSystems) if (!EXISTING_SYSTEM_KEYS.has(value)) errors.push(`Unknown existingSystems value: ${value}.`);
  }

  if (context.requireExplicitNfrs !== undefined && typeof context.requireExplicitNfrs !== 'boolean') errors.push('proposedContext.requireExplicitNfrs must be boolean.');
  if (context.nfrProfile !== undefined) validateNfrProfile(context.nfrProfile, 'proposedContext.nfrProfile', errors);
  if (context.integrationProfiles !== undefined) {
    if (!context.integrationProfiles || typeof context.integrationProfiles !== 'object' || Array.isArray(context.integrationProfiles)) errors.push('proposedContext.integrationProfiles must be an object.');
    else {
      for (const [integrationId, profile] of Object.entries(context.integrationProfiles)) {
        if (!/^integration\.[a-z0-9.-]+$/.test(integrationId)) errors.push(`Invalid integration profile ID: ${integrationId}.`);
        validateNfrProfile(profile, `proposedContext.integrationProfiles.${integrationId}`, errors);
      }
    }
  }

  if (context.securityProfile !== undefined && (!context.securityProfile || typeof context.securityProfile !== 'object' || Array.isArray(context.securityProfile))) {
    errors.push('proposedContext.securityProfile must be an object.');
  }

  if (Object.hasOwn(context, 'architectureDecisions')) errors.push('AI intake cannot propose architectureDecisions.');
  if (Object.hasOwn(context, 'currentLandscape')) errors.push('AI intake cannot create concrete currentLandscape instances; use evidence-backed import instead.');

  return { valid: errors.length === 0, errors: [...new Set(errors)].sort() };
}

export function createAiIntakeRequest(text, options = {}) {
  const suppliedText = String(text ?? '').trim();
  if (!suppliedText) throw new Error('AI intake requires explicitly supplied text.');
  const supplementalContext = options.supplementalContext === undefined ? null : structuredClone(options.supplementalContext);
  const explicitPayload = { text: suppliedText, supplementalContext };

  return {
    format: 'enterprise-architecture-composer/ai-intake-request',
    formatVersion: '0.1',
    inputDigest: digest(explicitPayload),
    explicitlySupplied: explicitPayload,
    instructions: {
      goal: 'Propose structured Enterprise Architecture Composer context from only the explicitly supplied input.',
      authority: 'proposal-only',
      prohibited: [
        'Do not invent architecture decisions.',
        'Do not invent concrete current application instances.',
        'Do not treat assumptions as explicit facts.',
        'Do not use external or remembered user/company context unless it appears in explicitlySupplied.'
      ],
      requiredOutput: {
        format: AI_INTAKE_FORMAT,
        formatVersion: AI_INTAKE_FORMAT_VERSION,
        inputDigest: '<copy request inputDigest>',
        proposedContext: '<structured context>',
        extractedFacts: [{ id: 'fact-1', path: 'processes', statement: '...', evidence: 'short excerpt from supplied text' }],
        assumptions: [{ id: 'assumption-1', path: 'constraints.highVolume', statement: '...', reason: '...' }],
        unknowns: [{ id: 'unknown-1', path: 'scale.countries', question: '...' }]
      },
      allowedProcessKeys: [...PROCESS_KEYS].sort(),
      allowedExistingSystemKeys: [...EXISTING_SYSTEM_KEYS].sort(),
      allowedContextFields: [...CONTEXT_FIELDS].sort()
    }
  };
}

function validateReviewItems(items, kind, errors) {
  if (!Array.isArray(items)) {
    errors.push(`${kind} must be an array.`);
    return;
  }
  const ids = [];
  for (const [index, item] of items.entries()) {
    if (!item?.id || !String(item.id).trim()) errors.push(`${kind}[${index}].id is required.`);
    else ids.push(item.id);
    if (!item?.path || !String(item.path).trim()) errors.push(`${kind}[${index}].path is required.`);
    if (kind === 'extractedFacts' && (!item?.evidence || !String(item.evidence).trim())) errors.push(`${kind}[${index}].evidence is required.`);
    if (kind === 'assumptions' && (!item?.reason || !String(item.reason).trim())) errors.push(`${kind}[${index}].reason is required.`);
    if (kind === 'unknowns' && (!item?.question || !String(item.question).trim())) errors.push(`${kind}[${index}].question is required.`);
  }
  for (const duplicate of duplicateValues(ids)) errors.push(`Duplicate ${kind} ID: ${duplicate}.`);
}

export function validateAiIntakeProposal(proposal, request = null) {
  const errors = [];
  if (proposal?.format !== AI_INTAKE_FORMAT) errors.push(`format must be ${AI_INTAKE_FORMAT}.`);
  if (proposal?.formatVersion !== AI_INTAKE_FORMAT_VERSION) errors.push(`formatVersion must be ${AI_INTAKE_FORMAT_VERSION}.`);
  if (!proposal?.inputDigest) errors.push('inputDigest is required.');
  if (request?.inputDigest && proposal?.inputDigest !== request.inputDigest) errors.push('proposal inputDigest does not match the explicit intake request.');

  const contextValidation = validateAiProposedContext(proposal?.proposedContext);
  errors.push(...contextValidation.errors);
  validateReviewItems(proposal?.extractedFacts, 'extractedFacts', errors);
  validateReviewItems(proposal?.assumptions, 'assumptions', errors);
  validateReviewItems(proposal?.unknowns, 'unknowns', errors);

  const assumptionPaths = new Set((proposal?.assumptions ?? []).map((item) => item.path));
  const factPaths = new Set((proposal?.extractedFacts ?? []).map((item) => item.path));
  for (const path of assumptionPaths) {
    if (factPaths.has(path)) errors.push(`Path ${path} is declared both explicit fact and assumption.`);
  }

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)].sort(),
    contextValidation,
    assumptionCount: proposal?.assumptions?.length ?? 0,
    unknownCount: proposal?.unknowns?.length ?? 0
  };
}

export async function requestAiIntakeProposal(text, provider, options = {}) {
  if (!provider || typeof provider.propose !== 'function') throw new Error('AI intake provider must implement propose(request).');
  const request = createAiIntakeRequest(text, options);
  const raw = await provider.propose(structuredClone(request));
  const proposal = typeof raw === 'string' ? JSON.parse(raw) : structuredClone(raw);
  const validation = validateAiIntakeProposal(proposal, request);
  return { request, proposal, validation };
}

export function acceptAiIntakeProposal(proposal, options = {}) {
  const validation = validateAiIntakeProposal(proposal);
  if (!validation.valid) return { accepted: false, errors: validation.errors, context: null, composition: null };

  const acceptedAssumptions = new Set(options.acceptedAssumptionIds ?? []);
  const rejected = (proposal.assumptions ?? []).filter((item) => !acceptedAssumptions.has(item.id));
  if (rejected.length) {
    return {
      accepted: false,
      errors: rejected.map((item) => `Assumption ${item.id} (${item.path}) requires explicit human acceptance.`),
      context: null,
      composition: null
    };
  }

  const context = structuredClone(proposal.proposedContext);
  try {
    const composition = composeArchitecture(context);
    return {
      accepted: true,
      errors: [],
      context,
      composition,
      review: {
        acceptedAssumptionIds: [...acceptedAssumptions].sort(),
        unresolvedUnknowns: structuredClone(proposal.unknowns ?? [])
      }
    };
  } catch (error) {
    return { accepted: false, errors: [`Deterministic Composer validation failed: ${error.message}`], context: null, composition: null };
  }
}
