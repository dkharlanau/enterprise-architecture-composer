import { buildDeliveryRoadmap } from './roadmap.mjs';

function sortedUnique(values = []) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function classifyFinding(finding) {
  if (['architecture-gap', 'catalog-quality'].includes(finding.kind)) return 'gaps';
  if (['question', 'nfr-decision', 'integration-driver-conflict', 'transition-decision', 'decision-drift'].includes(finding.kind)) return 'unknowns';
  if (['security-decision', 'operational-decision', 'integration-decision'].includes(finding.kind)) return 'operationalDecisions';
  return finding.severity === 'error' ? 'gaps' : 'unknowns';
}

function reviewFinding(finding) {
  return {
    id: finding.id,
    severity: finding.severity,
    kind: finding.kind,
    message: finding.message,
    nextDecision: finding.nextDecision,
    ruleIds: sortedUnique(finding.ruleIds),
    objectIds: sortedUnique(finding.objectIds)
  };
}

function reviewRecommendation(recommendation) {
  return {
    id: recommendation.id,
    kind: recommendation.kind,
    proposal: recommendation.decision,
    confidence: recommendation.confidence,
    ruleIds: sortedUnique(recommendation.ruleIds),
    objectIds: sortedUnique(recommendation.objectIds),
    humanDecision: recommendation.humanDecision ?? null,
    effectiveDecision: recommendation.humanDecision?.effectiveDecision ?? recommendation.decision
  };
}

export function createArchitectureReview(result) {
  const roadmap = buildDeliveryRoadmap(result);
  const buckets = { unknowns: [], gaps: [], operationalDecisions: [] };
  for (const finding of result.findings ?? []) buckets[classifyFinding(finding)].push(reviewFinding(finding));
  for (const values of Object.values(buckets)) values.sort((a, b) => a.id.localeCompare(b.id));

  const humanDecisions = (result.decisionRecords ?? []).map((record) => ({
    id: record.id,
    recommendationId: record.recommendationId,
    status: record.status,
    applies: record.applies,
    effectiveDecision: record.effectiveDecision,
    rationale: record.rationale ?? null,
    originalDecision: record.sourceRecommendation?.decision ?? null,
    ruleIds: sortedUnique(record.sourceRecommendation?.ruleIds)
  })).sort((a, b) => a.id.localeCompare(b.id));

  const transition = result.transition ? {
    replacements: result.transition.replacements.map((item) => ({
      id: item.id,
      kind: item.kind,
      currentId: item.currentId,
      targetId: item.targetId,
      ruleIds: sortedUnique(item.ruleIds)
    })),
    coexistenceWindows: result.transition.coexistenceWindows.map((item) => ({
      id: item.id,
      currentId: item.currentId,
      targetId: item.targetId,
      reason: item.reason
    }))
  } : null;

  const attentionCount = buckets.unknowns.length + buckets.gaps.length;
  const status = buckets.gaps.some((item) => item.severity === 'error')
    ? 'blocked'
    : attentionCount || humanDecisions.some((item) => !item.applies)
      ? 'attention-required'
      : 'ready-for-review';

  return {
    schemaVersion: '0.1',
    title: 'Enterprise Architecture Review',
    source: {
      engineVersion: result.engineVersion,
      catalogVersion: result.catalogVersion,
      blueprintSchemaVersion: result.schemaVersion
    },
    status,
    context: result.context,
    assumptions: [
      'Reference catalog semantics are proposals until adopted by the owning downstream artifact or architecture authority.',
      'Catalog-default NFRs are reference assumptions unless strict explicit NFR confirmation is enabled.',
      'Architecture shape alone does not establish security, regulatory or operational compliance.'
    ],
    target: {
      processes: result.blueprint.processes.map((item) => ({ id: item.id, name: item.name })),
      capabilities: result.blueprint.capabilities.map((item) => ({ id: item.id, name: item.name })),
      systems: result.blueprint.systems.map((item) => ({ id: item.id, name: item.name, intent: item.intent, reasonIds: sortedUnique(item.reasonIds) })),
      integrations: result.blueprint.integrations.map((item) => ({
        id: item.id,
        name: item.name,
        source: item.source,
        target: item.target,
        proposedPatternId: item.patternId,
        recommendedPatternId: item.decisionAnalysis?.recommendedPatternId ?? item.patternId,
        effectivePatternId: item.decisionAnalysis?.effectivePatternId ?? item.decisionAnalysis?.recommendedPatternId ?? item.patternId,
        effectiveDecisionSource: item.decisionAnalysis?.effectiveDecisionSource ?? 'composer',
        ruleIds: sortedUnique(item.ruleIds)
      })),
      dataObjects: result.blueprint.dataObjects.map((item) => ({ id: item.id, name: item.name, owner: item.owner }))
    },
    transition,
    recommendations: result.recommendations.map(reviewRecommendation).sort((a, b) => a.id.localeCompare(b.id)),
    humanDecisions,
    unknowns: buckets.unknowns,
    gaps: buckets.gaps,
    operationalDecisions: buckets.operationalDecisions,
    roadmap: {
      summary: roadmap.summary,
      packages: roadmap.packages.map((item) => ({
        id: item.id,
        title: item.title,
        phase: item.phase,
        wave: item.wave,
        classification: item.classification,
        dependsOn: item.dependsOn,
        sourceIds: item.sourceIds,
        rationale: item.rationale
      }))
    },
    summary: {
      unknownCount: buckets.unknowns.length,
      gapCount: buckets.gaps.length,
      operationalDecisionCount: buckets.operationalDecisions.length,
      humanDecisionCount: humanDecisions.length,
      orphanedHumanDecisionCount: humanDecisions.filter((item) => !item.applies).length,
      workPackageCount: roadmap.summary.packageCount
    }
  };
}

function mdIds(values = []) {
  return values.length ? values.map((id) => `\`${id}\``).join(', ') : 'none';
}

export function architectureReviewMarkdown(review) {
  const lines = [
    `# ${review.title}`,
    '',
    `Status: **${review.status}**`,
    '',
    `Engine: ${review.source.engineVersion} · Catalog: ${review.source.catalogVersion}`,
    '',
    '## Assumptions',
    '',
    ...review.assumptions.map((item) => `- ${item}`),
    '',
    '## Target architecture',
    '',
    `- Processes: ${review.target.processes.length}`,
    `- Capabilities: ${review.target.capabilities.length}`,
    `- System roles: ${review.target.systems.length}`,
    `- Integrations: ${review.target.integrations.length}`,
    `- Data objects: ${review.target.dataObjects.length}`,
    '',
    '### System responsibilities',
    ''
  ];

  for (const item of review.target.systems) {
    lines.push(`- **${item.name}** — \`${item.id}\`; intent: ${item.intent}; reasons: ${mdIds(item.reasonIds)}`);
  }

  lines.push('', '### Integration decisions', '');
  for (const item of review.target.integrations) {
    lines.push(`- **${item.name}** — \`${item.id}\`; \`${item.source}\` → \`${item.target}\``);
    lines.push(`  - Proposal: \`${item.proposedPatternId}\``);
    lines.push(`  - Recommended: \`${item.recommendedPatternId}\``);
    lines.push(`  - Effective: ${item.effectivePatternId ? `\`${item.effectivePatternId}\`` : 'none / rejected'} (${item.effectiveDecisionSource})`);
    lines.push(`  - Rule(s): ${mdIds(item.ruleIds)}`);
  }

  if (review.transition) {
    lines.push('', '## Current → transition → target', '');
    for (const item of review.transition.replacements) {
      lines.push(`- **${item.kind}** — \`${item.currentId}\` → \`${item.targetId}\`; rules: ${mdIds(item.ruleIds)}`);
    }
    for (const window of review.transition.coexistenceWindows) {
      lines.push(`- Coexistence \`${window.id}\`: \`${window.currentId}\` + \`${window.targetId}\` — ${window.reason}`);
    }
  }

  const findingSection = (title, items) => {
    lines.push('', `## ${title}`, '');
    if (!items.length) lines.push('None.');
    for (const item of items) {
      lines.push(`### ${item.id}`);
      lines.push('');
      lines.push(`- ${item.message}`);
      lines.push(`- Severity: ${item.severity}`);
      lines.push(`- Object(s): ${mdIds(item.objectIds)}`);
      lines.push(`- Rule(s): ${mdIds(item.ruleIds)}`);
      lines.push(`- Next decision: ${item.nextDecision}`);
      lines.push('');
    }
  };

  findingSection('Unknowns / decisions to confirm', review.unknowns);
  findingSection('Architecture gaps', review.gaps);
  findingSection('Operational / security decisions', review.operationalDecisions);

  lines.push('## Human architecture decisions', '');
  if (!review.humanDecisions.length) lines.push('None recorded.');
  for (const item of review.humanDecisions) {
    lines.push(`### ${item.id}`);
    lines.push('');
    lines.push(`- Recommendation: \`${item.recommendationId}\``);
    lines.push(`- Status: ${item.status}`);
    lines.push(`- Applies: ${item.applies ? 'yes' : 'no'}`);
    lines.push(`- Original decision: ${item.originalDecision ? `\`${item.originalDecision}\`` : 'unknown'}`);
    lines.push(`- Effective decision: ${item.effectiveDecision ? `\`${item.effectiveDecision}\`` : 'none / rejected'}`);
    lines.push(`- Rule(s): ${mdIds(item.ruleIds)}`);
    if (item.rationale) lines.push(`- Rationale: ${item.rationale}`);
    lines.push('');
  }

  lines.push('## Delivery roadmap', '');
  for (const item of review.roadmap.packages) {
    lines.push(`- **Wave ${item.wave} · ${item.title}** — \`${item.id}\`; ${item.classification}; phase: ${item.phase}`);
    lines.push(`  - Source object(s): ${mdIds(item.sourceIds)}`);
    lines.push(`  - Depends on: ${mdIds(item.dependsOn)}`);
    lines.push(`  - Rationale: ${item.rationale}`);
  }

  lines.push('', '## Review summary', '');
  lines.push(`- Unknowns: ${review.summary.unknownCount}`);
  lines.push(`- Architecture gaps: ${review.summary.gapCount}`);
  lines.push(`- Operational/security decisions: ${review.summary.operationalDecisionCount}`);
  lines.push(`- Human decisions: ${review.summary.humanDecisionCount}`);
  lines.push(`- Orphaned human decisions: ${review.summary.orphanedHumanDecisionCount}`);
  lines.push(`- Work packages: ${review.summary.workPackageCount}`);

  return `${lines.join('\n')}\n`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function architectureReviewHtml(review) {
  const md = architectureReviewMarkdown(review);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(review.title)}</title>
<style>
body{font:15px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:960px;margin:0 auto;padding:42px 28px;color:#18202a;background:#f6f7f5}main{background:white;border:1px solid #d8dde0;padding:34px}pre{white-space:pre-wrap;font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}header{margin-bottom:24px}header span{font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.05em;color:#64707c}.status{display:inline-block;margin-top:8px;padding:5px 8px;border:1px solid #b8c18f;background:#f2f7dc;font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace}</style>
</head>
<body><main><header><span>Enterprise Architecture Composer</span><h1>${escapeHtml(review.title)}</h1><div class="status">${escapeHtml(review.status)}</div></header><pre>${escapeHtml(md)}</pre></main></body>
</html>\n`;
}
