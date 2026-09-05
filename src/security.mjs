const EXPOSURES = new Set(['internal', 'private', 'public', 'partner']);
const CLASSIFICATIONS = new Set(['public', 'internal', 'confidential', 'sensitive', 'regulated']);

function sortedUnique(values = []) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function uniqueById(items = []) {
  return [...new Map(items.map((item) => [item.id, item])).values()].sort((a, b) => a.id.localeCompare(b.id));
}

function stem(id, prefix) {
  return String(id ?? '').replace(prefix, '').replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function integrationProfile(profile, integration) {
  const explicit = profile?.integrations?.[integration.id] ?? {};
  const exposure = integration.partnerBoundary
    ? 'partner'
    : EXPOSURES.has(explicit.exposure) ? explicit.exposure : 'internal';
  return {
    exposure,
    authenticationBoundary: Boolean(explicit.authenticationBoundary),
    privileged: Boolean(explicit.privileged),
    auditEvidence: explicit.auditEvidence === 'required' ? 'required' : 'not-specified'
  };
}

function dataProfile(profile, dataObjectId) {
  const explicit = profile?.data?.[dataObjectId] ?? {};
  return {
    classification: CLASSIFICATIONS.has(explicit.classification) ? explicit.classification : 'internal',
    residency: sortedUnique(Array.isArray(explicit.residency) ? explicit.residency.map(String) : []),
    auditEvidence: explicit.auditEvidence === true
  };
}

function boundary({ id, name, boundaryType, description, integrations = [], ruleIds = [], source }) {
  return {
    id,
    kind: 'trust-boundary',
    name,
    boundaryType,
    description,
    integrationIds: sortedUnique(integrations.map((item) => item.id)),
    systemIds: sortedUnique(integrations.flatMap((item) => [item.source, item.target])),
    dataObjectIds: sortedUnique(integrations.map((item) => item.dataObject)),
    ruleIds: sortedUnique(ruleIds),
    source
  };
}

function finding(id, ruleId, objectIds, message, nextDecision) {
  return {
    id,
    severity: 'warning',
    kind: 'security-decision',
    ruleIds: [ruleId],
    objectIds: sortedUnique(objectIds),
    message,
    nextDecision
  };
}

function workPackage(id, title, sourceIds) {
  return {
    id,
    phase: 'security',
    title,
    mandatory: true,
    dependsOn: ['wp.architecture.resolve-decisions'],
    sourceIds: sortedUnique(sourceIds)
  };
}

export function composeSecurity(result, securityProfile = {}) {
  const integrations = result.blueprint?.integrations ?? [];
  const dataObjects = result.blueprint?.dataObjects ?? [];
  const profiles = new Map(integrations.map((item) => [item.id, integrationProfile(securityProfile, item)]));
  const trustBoundaries = [];
  const findings = [];
  const workPackages = [];

  const partnerFlows = integrations.filter((item) => profiles.get(item.id).exposure === 'partner');
  if (partnerFlows.length) {
    trustBoundaries.push(boundary({
      id: 'trust.external-partner',
      name: 'External partner trust boundary',
      boundaryType: 'external-partner',
      description: 'Crosses an external trading-partner trust boundary; identity, transport security and evidence require explicit design.',
      integrations: partnerFlows,
      ruleIds: ['SEC-PARTNER-001'],
      source: 'derived-from-partner-boundary'
    }));
  }

  const publicFlows = integrations.filter((item) => profiles.get(item.id).exposure === 'public');
  if (publicFlows.length) {
    trustBoundaries.push(boundary({
      id: 'trust.public-api',
      name: 'Public API trust boundary',
      boundaryType: 'public-api',
      description: 'Explicitly internet/public exposed integration boundary.',
      integrations: publicFlows,
      ruleIds: ['SEC-PUBLIC-001'],
      source: 'explicit-security-profile'
    }));
    for (const item of publicFlows) {
      findings.push(finding(
        `finding.security.public.${stem(item.id, 'integration.')}`,
        'SEC-PUBLIC-001',
        [item.id, item.source, item.target],
        `${item.name} is explicitly marked as public-facing.`,
        'Define authentication, authorization, abuse/rate controls, transport security and public API audit evidence. Architecture shape alone does not establish compliance.'
      ));
    }
    workPackages.push(workPackage(
      'wp.security.public-api',
      'Define controls for public API exposure',
      publicFlows.map((item) => item.id)
    ));
  }

  const privateFlows = integrations.filter((item) => profiles.get(item.id).exposure === 'private');
  if (privateFlows.length) {
    trustBoundaries.push(boundary({
      id: 'trust.private-api',
      name: 'Private API trust boundary',
      boundaryType: 'private-api',
      description: 'Explicit private network or identity boundary that still requires an enforceable trust model.',
      integrations: privateFlows,
      ruleIds: ['SEC-PRIVATE-001'],
      source: 'explicit-security-profile'
    }));
    for (const item of privateFlows) {
      findings.push(finding(
        `finding.security.private.${stem(item.id, 'integration.')}`,
        'SEC-PRIVATE-001',
        [item.id, item.source, item.target],
        `${item.name} crosses an explicitly declared private trust boundary.`,
        'Confirm network segmentation, caller identity, authorization and boundary ownership; private connectivity must not be treated as implicit trust.'
      ));
    }
    workPackages.push(workPackage(
      'wp.security.private-api',
      'Define controls for private trust boundaries',
      privateFlows.map((item) => item.id)
    ));
  }

  const identityFlows = integrations.filter((item) => profiles.get(item.id).authenticationBoundary);
  if (identityFlows.length) {
    trustBoundaries.push(boundary({
      id: 'trust.identity',
      name: 'Identity and authentication boundary',
      boundaryType: 'identity',
      description: 'Identity changes, is asserted or must be propagated across this boundary.',
      integrations: identityFlows,
      ruleIds: ['SEC-IDENTITY-001'],
      source: 'explicit-security-profile'
    }));
    for (const item of identityFlows) {
      findings.push(finding(
        `finding.security.identity.${stem(item.id, 'integration.')}`,
        'SEC-IDENTITY-001',
        [item.id, item.source, item.target],
        `${item.name} is marked as an authentication/identity boundary.`,
        'Define trusted identity issuer, token/credential propagation, authorization context, expiry and failure behavior.'
      ));
    }
    workPackages.push(workPackage(
      'wp.security.identity-boundaries',
      'Define identity propagation and authentication boundaries',
      identityFlows.map((item) => item.id)
    ));
  }

  const privilegedFlows = integrations.filter((item) => profiles.get(item.id).privileged);
  if (privilegedFlows.length) {
    trustBoundaries.push(boundary({
      id: 'trust.privileged-integration',
      name: 'Privileged integration boundary',
      boundaryType: 'privileged',
      description: 'Integration has elevated privileges and requires explicit least-privilege, credential and audit decisions.',
      integrations: privilegedFlows,
      ruleIds: ['SEC-PRIVILEGED-001'],
      source: 'explicit-security-profile'
    }));
    for (const item of privilegedFlows) {
      findings.push(finding(
        `finding.security.privileged.${stem(item.id, 'integration.')}`,
        'SEC-PRIVILEGED-001',
        [item.id, item.source, item.target],
        `${item.name} is explicitly marked as privileged.`,
        'Define least privilege, credential/secrets lifecycle, break-glass ownership and privileged action audit evidence.'
      ));
    }
    workPackages.push(workPackage(
      'wp.security.privileged-integrations',
      'Define least-privilege and secret controls for privileged integrations',
      privilegedFlows.map((item) => item.id)
    ));
  }

  const sensitiveDataIds = [];
  const residencyDataIds = [];
  const dataAuditIds = [];
  for (const item of dataObjects) {
    const data = dataProfile(securityProfile, item.id);
    const affectedFlows = integrations.filter((integration) => integration.dataObject === item.id);
    if (['sensitive', 'regulated'].includes(data.classification)) {
      sensitiveDataIds.push(item.id);
      trustBoundaries.push({
        id: `trust.data.${stem(item.id, 'data.')}`,
        kind: 'trust-boundary',
        name: `${item.name} sensitive-data boundary`,
        boundaryType: 'sensitive-data',
        description: `${item.name} is explicitly classified ${data.classification}; access, exposure and logging require review.`,
        integrationIds: sortedUnique(affectedFlows.map((integration) => integration.id)),
        systemIds: sortedUnique(affectedFlows.flatMap((integration) => [integration.source, integration.target])),
        dataObjectIds: [item.id],
        ruleIds: ['SEC-SENSITIVE-001'],
        source: 'explicit-security-profile'
      });
      findings.push(finding(
        `finding.security.data.${stem(item.id, 'data.')}`,
        'SEC-SENSITIVE-001',
        [item.id, ...affectedFlows.map((flow) => flow.id)],
        `${item.name} is explicitly classified ${data.classification}.`,
        'Define access control, encryption, masking/redaction and logging rules for this data. This is a design prompt, not a compliance verdict.'
      ));
    }
    if (data.residency.length) {
      residencyDataIds.push(item.id);
      trustBoundaries.push({
        id: `trust.residency.${stem(item.id, 'data.')}`,
        kind: 'trust-boundary',
        name: `${item.name} residency boundary`,
        boundaryType: 'residency',
        description: `${item.name} carries explicit residency constraints: ${data.residency.join(', ')}.`,
        integrationIds: sortedUnique(affectedFlows.map((integration) => integration.id)),
        systemIds: sortedUnique(affectedFlows.flatMap((integration) => [integration.source, integration.target])),
        dataObjectIds: [item.id],
        ruleIds: ['SEC-RESIDENCY-001'],
        source: 'explicit-security-profile'
      });
      findings.push(finding(
        `finding.security.residency.${stem(item.id, 'data.')}`,
        'SEC-RESIDENCY-001',
        [item.id, ...affectedFlows.map((flow) => flow.id)],
        `${item.name} has explicit residency constraints: ${data.residency.join(', ')}.`,
        'Confirm actual processing, storage, backup, support and observability locations against the stated residency requirement; Composer does not infer compliance.'
      ));
    }
    if (data.auditEvidence) dataAuditIds.push(item.id);
  }

  if (sensitiveDataIds.length) {
    workPackages.push(workPackage(
      'wp.security.sensitive-data',
      'Define sensitive-data access, encryption and logging controls',
      sensitiveDataIds
    ));
  }
  if (residencyDataIds.length) {
    workPackages.push(workPackage(
      'wp.security.data-residency',
      'Validate data residency and processing-location constraints',
      residencyDataIds
    ));
  }

  const auditIntegrationIds = integrations
    .filter((item) => profiles.get(item.id).auditEvidence === 'required')
    .map((item) => item.id);
  const auditSourceIds = sortedUnique([...auditIntegrationIds, ...dataAuditIds]);
  if (auditSourceIds.length) {
    findings.push(finding(
      'finding.security.audit-evidence',
      'SEC-AUDIT-001',
      auditSourceIds,
      'The security profile requires explicit audit evidence for selected integrations or data objects.',
      'Define which security-relevant events constitute evidence, where evidence is retained, who can access it and how completeness is verified.'
    ));
    workPackages.push(workPackage(
      'wp.security.audit-evidence',
      'Define security audit-evidence production and retention',
      auditSourceIds
    ));
  }

  const integrationDependencies = Object.fromEntries(integrations.map((integration) => {
    const ids = workPackages
      .filter((item) => item.sourceIds.includes(integration.id))
      .map((item) => item.id);
    return [integration.id, sortedUnique(ids)];
  }).filter(([, ids]) => ids.length));

  return {
    schemaVersion: '0.1',
    trustBoundaries: uniqueById(trustBoundaries),
    findings: uniqueById(findings),
    workPackages: uniqueById(workPackages),
    integrationDependencies,
    review: {
      complianceStatus: 'not-assessed',
      statement: 'Security composition identifies architecture boundaries and decisions only. It does not assert regulatory, privacy or security compliance.'
    },
    metrics: {
      trustBoundaryCount: uniqueById(trustBoundaries).length,
      securityDecisionCount: uniqueById(findings).length,
      securityWorkPackageCount: uniqueById(workPackages).length,
      sensitiveDataObjectCount: sortedUnique(sensitiveDataIds).length,
      residencyConstraintCount: sortedUnique(residencyDataIds).length,
      publicIntegrationCount: publicFlows.length,
      privilegedIntegrationCount: privilegedFlows.length
    }
  };
}
