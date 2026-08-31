const PHASE_ORDER = ['architecture', 'foundation', 'data', 'security', 'integration', 'assurance', 'testing', 'cutover'];

function sortedUnique(values = []) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function indexResult(result) {
  const objects = new Map();
  for (const collection of Object.values(result.blueprint ?? {})) {
    if (!Array.isArray(collection)) continue;
    for (const item of collection) objects.set(item.id, item);
  }
  for (const item of result.findings ?? []) objects.set(item.id, item);
  for (const item of result.recommendations ?? []) objects.set(item.id, item);
  return objects;
}

function triggerFor(workPackage, result) {
  if (workPackage.id === 'wp.foundation.integration-platform') return 'integration-platform responsibility is present in the composed target';
  if (workPackage.id === 'wp.data.master-data') return 'MDM responsibility is present in the composed target';
  if (workPackage.id === 'wp.security.partner-boundary') return 'one or more integrations cross an external partner boundary';
  if (workPackage.id === 'wp.assurance.async-flows') return 'one or more composed integrations are asynchronous';
  if (workPackage.id === 'wp.testing.end-to-end') return 'the composed solution contains cross-system integration scope';
  if (workPackage.id === 'wp.cutover.wms-coexistence') return 'the context explicitly retains the legacy WMS';
  if (workPackage.id.startsWith('wp.integration.')) return 'the corresponding integration is present in the target blueprint';
  if (workPackage.id === 'wp.architecture.resolve-decisions') return 'architecture findings or assumptions must be confirmed before downstream implementation';
  return 'derived from the selected architecture scope';
}

function classificationFor(workPackage) {
  if (workPackage.id === 'wp.cutover.wms-coexistence') return 'conditional';
  if (workPackage.id === 'wp.security.partner-boundary') return 'conditional';
  return workPackage.mandatory === false ? 'conditional' : 'mandatory';
}

function rationaleFor(workPackage, objectIndex) {
  const sourceNames = sortedUnique((workPackage.sourceIds ?? []).map((id) => {
    const object = objectIndex.get(id);
    return object?.name ?? object?.message ?? id;
  }));

  if (!sourceNames.length) return 'Required to make the composed architecture implementation-ready.';
  return `Derived from: ${sourceNames.join('; ')}.`;
}

function computeDepths(packages) {
  const byId = new Map(packages.map((item) => [item.id, item]));
  const memo = new Map();
  const visiting = new Set();

  function depth(id) {
    if (memo.has(id)) return memo.get(id);
    if (visiting.has(id)) throw new Error(`Roadmap dependency cycle detected at ${id}`);
    visiting.add(id);
    const item = byId.get(id);
    if (!item) throw new Error(`Roadmap dependency not found: ${id}`);
    const parents = item.dependsOn ?? [];
    const value = parents.length ? 1 + Math.max(...parents.map(depth)) : 0;
    visiting.delete(id);
    memo.set(id, value);
    return value;
  }

  for (const item of packages) depth(item.id);
  return memo;
}

export function buildDeliveryRoadmap(result) {
  const objectIndex = indexResult(result);
  const packages = (result.workPackages ?? []).map((workPackage) => ({
    ...workPackage,
    dependsOn: sortedUnique(workPackage.dependsOn),
    sourceIds: sortedUnique(workPackage.sourceIds),
    classification: classificationFor(workPackage),
    trigger: triggerFor(workPackage, result),
    rationale: rationaleFor(workPackage, objectIndex),
    labels: sortedUnique([
      `phase:${workPackage.phase}`,
      `scope:${classificationFor(workPackage)}`,
      ...(workPackage.id.startsWith('wp.integration.') ? ['work:integration'] : []),
      ...(workPackage.id.includes('security') ? ['work:security'] : []),
      ...(workPackage.id.includes('testing') ? ['work:testing'] : [])
    ])
  }));

  const depths = computeDepths(packages);
  const enriched = packages.map((item) => ({ ...item, wave: depths.get(item.id) + 1 }));
  const waves = [];
  for (const item of enriched) {
    const wave = item.wave;
    if (!waves[wave - 1]) waves[wave - 1] = { wave, packageIds: [] };
    waves[wave - 1].packageIds.push(item.id);
  }
  for (const wave of waves) wave.packageIds.sort((a, b) => a.localeCompare(b));

  const phases = PHASE_ORDER
    .map((phase) => ({
      phase,
      packages: enriched.filter((item) => item.phase === phase).sort((a, b) => a.id.localeCompare(b.id))
    }))
    .filter((item) => item.packages.length);

  const maxWave = Math.max(0, ...enriched.map((item) => item.wave));
  const criticalPackageIds = enriched.filter((item) => item.wave === maxWave).map((item) => item.id).sort();

  return {
    schemaVersion: '0.1',
    source: {
      engineVersion: result.engineVersion,
      catalogVersion: result.catalogVersion,
      context: result.context
    },
    phases,
    waves,
    packages: enriched.sort((a, b) => a.wave - b.wave || a.id.localeCompare(b.id)),
    summary: {
      packageCount: enriched.length,
      mandatoryCount: enriched.filter((item) => item.classification === 'mandatory').length,
      conditionalCount: enriched.filter((item) => item.classification === 'conditional').length,
      waveCount: waves.length,
      criticalPackageIds
    }
  };
}

export function roadmapToMarkdown(roadmap) {
  const lines = [
    '# Architecture Delivery Roadmap',
    '',
    `Packages: ${roadmap.summary.packageCount} · Waves: ${roadmap.summary.waveCount} · Mandatory: ${roadmap.summary.mandatoryCount} · Conditional: ${roadmap.summary.conditionalCount}`,
    ''
  ];

  for (const phase of roadmap.phases) {
    lines.push(`## ${phase.phase}`);
    lines.push('');
    for (const item of phase.packages) {
      lines.push(`### ${item.title}`);
      lines.push('');
      lines.push(`- ID: \`${item.id}\``);
      lines.push(`- Scope: ${item.classification}`);
      lines.push(`- Wave: ${item.wave}`);
      lines.push(`- Trigger: ${item.trigger}`);
      lines.push(`- Rationale: ${item.rationale}`);
      lines.push(`- Depends on: ${item.dependsOn.length ? item.dependsOn.map((id) => `\`${id}\``).join(', ') : 'none'}`);
      lines.push(`- Source objects: ${item.sourceIds.length ? item.sourceIds.map((id) => `\`${id}\``).join(', ') : 'none'}`);
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}
