import { composeArchitecture } from './composer.mjs';
import { explainObject } from './engine.mjs';
import { diffCompositions } from './diff.mjs';
import { buildDeliveryRoadmap } from './roadmap.mjs';
import { bundleToMarkdown, createPortableBundle, serializeBundle } from './export.mjs';
import { processes, systems, dataObjects, integrationPatterns, byId } from './catalog.mjs';

const DEFAULT_SCENARIO = {
  processes: ['order-to-cash', 'procure-to-pay', 'plan-to-produce'],
  constraints: {
    multiCompany: true,
    highVolume: true,
    retainLegacyWms: false
  },
  existingSystems: ['erp', 'legacy-wms'],
  scale: { countries: 8, legalEntities: 12, plants: 4, warehouses: 11 }
};

const WMS_REPLACEMENT_LANDSCAPE = {
  systems: [
    { id: 'app.current-erp', name: 'Current ERP', roleId: 'sys.erp', strategy: 'keep' },
    { id: 'app.current-crm', name: 'Current CRM', roleId: 'sys.crm', strategy: 'keep' },
    { id: 'app.legacy-wms', name: 'Legacy WMS', roleId: 'sys.wms', strategy: 'replace', replacementRoleId: 'sys.wms' }
  ],
  integrations: [
    {
      id: 'if.current-order',
      name: 'Current CRM order creation',
      sourceSystemId: 'app.current-crm',
      targetSystemId: 'app.current-erp',
      targetIntegrationId: 'integration.sales-order-request',
      strategy: 'keep'
    },
    {
      id: 'if.legacy-wms-outbound',
      name: 'Current delivery release to legacy WMS',
      sourceSystemId: 'app.current-erp',
      targetSystemId: 'app.legacy-wms',
      targetIntegrationId: 'integration.delivery-to-warehouse',
      strategy: 'replace'
    }
  ]
};

const state = {
  view: 'blueprint',
  selectedId: null,
  result: null,
  baselineResult: null,
  delta: null,
  currentLandscape: null
};

const form = document.querySelector('#context-form');
const processOptions = document.querySelector('#process-options');
const canvas = document.querySelector('#canvas');
const decisionSummary = document.querySelector('#decision-summary');
const decisionDetail = document.querySelector('#decision-detail');
const resetButton = document.querySelector('#reset-demo');
const baselineButton = document.querySelector('#set-baseline');
const exportBundleButton = document.querySelector('#export-bundle');
const exportReportButton = document.querySelector('#export-report');
const loadTransitionButton = document.querySelector('#load-transition-demo');
const clearCurrentLandscapeButton = document.querySelector('#clear-current-landscape');
const migrationStatus = document.querySelector('#migration-status');
const viewTabs = [...document.querySelectorAll('.view-tab[data-view]')];

const html = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function renderProcessOptions() {
  processOptions.innerHTML = processes.map((process) => `
    <label class="process-option">
      <input type="checkbox" name="process" value="${html(process.key)}" />
      <span>
        <strong>${html(process.name)}</strong>
        <small>${html(process.description)}</small>
      </span>
    </label>
  `).join('');
}

function setChecked(name, values) {
  const wanted = new Set(values);
  form.querySelectorAll(`[name="${name}"]`).forEach((input) => {
    input.checked = wanted.has(input.value);
  });
}

function applyDefaultScenario() {
  state.currentLandscape = null;
  setChecked('process', DEFAULT_SCENARIO.processes);
  setChecked('existingSystem', DEFAULT_SCENARIO.existingSystems);
  form.elements.multiCompany.checked = DEFAULT_SCENARIO.constraints.multiCompany;
  form.elements.highVolume.checked = DEFAULT_SCENARIO.constraints.highVolume;
  form.elements.retainLegacyWms.checked = DEFAULT_SCENARIO.constraints.retainLegacyWms;
  form.elements.countries.value = DEFAULT_SCENARIO.scale.countries;
  form.elements.legalEntities.value = DEFAULT_SCENARIO.scale.legalEntities;
  form.elements.plants.value = DEFAULT_SCENARIO.scale.plants;
  form.elements.warehouses.value = DEFAULT_SCENARIO.scale.warehouses;
  form.elements.nfrVolume.value = '';
  form.elements.nfrReplay.value = '';
  form.elements.nfrOffline.value = '';
  form.elements.nfrChange.value = '';
  renderMigrationStatus();
}

function applyTransitionScenario() {
  state.currentLandscape = structuredClone(WMS_REPLACEMENT_LANDSCAPE);
  setChecked('process', ['order-to-cash']);
  setChecked('existingSystem', ['erp', 'crm']);
  form.elements.multiCompany.checked = false;
  form.elements.highVolume.checked = false;
  form.elements.retainLegacyWms.checked = false;
  form.elements.countries.value = 2;
  form.elements.legalEntities.value = 2;
  form.elements.plants.value = 1;
  form.elements.warehouses.value = 3;
  renderMigrationStatus();
}

function renderMigrationStatus() {
  if (!state.currentLandscape) {
    migrationStatus.className = 'migration-status';
    migrationStatus.innerHTML = 'No application-instance migration scenario loaded.';
    clearCurrentLandscapeButton.disabled = true;
    return;
  }

  const replacements = state.currentLandscape.systems.filter((item) => item.strategy === 'replace');
  migrationStatus.className = 'migration-status active';
  migrationStatus.innerHTML = `
    <strong>${state.currentLandscape.systems.length} current apps</strong>
    <span>${replacements.length} replacement${replacements.length === 1 ? '' : 's'} · ${state.currentLandscape.integrations.length} current interfaces</span>
  `;
  clearCurrentLandscapeButton.disabled = false;
}

function readNfrProfile() {
  const profile = {};
  if (form.elements.nfrVolume.value) profile.volume = form.elements.nfrVolume.value;
  if (form.elements.nfrReplay.value) profile.replay = form.elements.nfrReplay.value;
  if (form.elements.nfrOffline.value) profile.offlineTolerance = form.elements.nfrOffline.value;
  if (form.elements.nfrChange.value) profile.changeFrequency = form.elements.nfrChange.value;
  return Object.keys(profile).length ? profile : null;
}

function roleAlias(roleId) {
  const aliases = {
    'sys.erp': 'erp',
    'sys.crm': 'crm',
    'sys.mdm': 'mdm',
    'sys.wms': 'legacy-wms',
    'sys.mes': 'mes',
    'sys.tms': 'tms',
    'sys.integration': 'integration-platform',
    'sys.data-platform': 'data-platform',
    'sys.partner-edge': 'partner-edge'
  };
  return aliases[roleId] ?? roleId;
}

function readContext() {
  const selectedProcesses = [...form.querySelectorAll('[name="process"]:checked')].map((input) => input.value);
  const selectedExistingSystems = [...form.querySelectorAll('[name="existingSystem"]:checked')].map((input) => input.value);
  const currentKeepSystems = state.currentLandscape
    ? state.currentLandscape.systems.filter((item) => item.strategy === 'keep').map((item) => roleAlias(item.roleId))
    : null;
  const nfrProfile = readNfrProfile();

  return {
    industry: 'manufacturing',
    operatingModel: 'b2b',
    processes: selectedProcesses,
    constraints: {
      multiCompany: form.elements.multiCompany.checked,
      highVolume: form.elements.highVolume.checked,
      retainLegacyWms: form.elements.retainLegacyWms.checked
    },
    existingSystems: currentKeepSystems ?? selectedExistingSystems,
    scale: {
      countries: Number(form.elements.countries.value),
      legalEntities: Number(form.elements.legalEntities.value),
      plants: Number(form.elements.plants.value),
      warehouses: Number(form.elements.warehouses.value)
    },
    ...(nfrProfile ? { nfrProfile } : {}),
    ...(state.currentLandscape ? { currentLandscape: structuredClone(state.currentLandscape) } : {})
  };
}

function systemLabel(id) {
  return byId(systems, id)?.name ?? id;
}

function dataLabel(id) {
  return byId(dataObjects, id)?.name ?? id;
}

function patternLabel(id) {
  return byId(integrationPatterns, id)?.name ?? id;
}

function selectedClass(id) {
  return state.selectedId === id ? ' selected' : '';
}

function objectCard(item, kind = item.kind) {
  const description = item.description ? `<small>${html(item.description)}</small>` : '';
  return `
    <button class="object-card${kind === 'system-role' ? ' system-card' : ''}${selectedClass(item.id)}" type="button" data-object-id="${html(item.id)}">
      ${kind === 'system-role' ? `
        <span class="state-row">
          <span class="object-kind">System role</span>
          <span class="state-tag ${html(item.state)}">${html(item.state)}</span>
        </span>
      ` : `<span class="object-kind">${html(kind.replaceAll('-', ' '))}</span>`}
      <strong>${html(item.name)}</strong>
      ${description}
    </button>
  `;
}

function patternClass(patternId) {
  if (patternId === 'pattern.domain-event') return ' event';
  if (patternId === 'pattern.edi-b2b') return ' partner';
  if (patternId === 'pattern.batch-file' || patternId === 'pattern.etl-elt') return ' batch';
  return '';
}

function decisionState(integration) {
  const analysis = integration.decisionAnalysis;
  if (!analysis) return '';
  if (analysis.selectedMatchesBlueprint) return `<span class="fit-chip preferred">${html(analysis.recommendedFit ?? 'preferred')}</span>`;
  return `<span class="fit-chip warning">review ${html(patternLabel(analysis.recommendedPatternId))}</span>`;
}

function renderBlueprint() {
  const result = state.result;
  const capabilityCards = result.blueprint.capabilities.map((item) => objectCard(item)).join('');
  const systemCards = result.blueprint.systems.map((item) => objectCard(item, 'system-role')).join('');
  const flows = result.blueprint.integrations.map((integration) => `
    <button class="flow-card${selectedClass(integration.id)}" type="button" data-object-id="${html(integration.id)}">
      <span class="flow-endpoint">${html(systemLabel(integration.source))}</span>
      <span class="flow-arrow">→</span>
      <span class="flow-endpoint">${html(systemLabel(integration.target))}</span>
      <span class="flow-object">${html(dataLabel(integration.dataObject))} · ${html(integration.name)}</span>
      <span class="flow-decision">${decisionState(integration)}<span class="pattern-chip${patternClass(integration.patternId)}">${html(integration.patternName)}</span></span>
    </button>
  `).join('');

  return `
    <div class="canvas-inner">
      <section class="architecture-layer">
        <div class="layer-label"><strong>Business</strong><small>Capabilities implied by selected process scope.</small></div>
        <div class="layer-content"><div class="node-grid">${capabilityCards}</div></div>
      </section>
      <section class="architecture-layer">
        <div class="layer-label"><strong>Applications</strong><small>Logical responsibilities, not vendor products.</small></div>
        <div class="layer-content"><div class="node-grid">${systemCards}</div></div>
      </section>
      <section class="architecture-layer">
        <div class="layer-label"><strong>Flow</strong><small>Cross-system needs with an explainable pattern decision.</small></div>
        <div class="layer-content"><div class="flow-list">${flows || '<div class="empty-state">No cross-system flows in the current scope.</div>'}</div></div>
      </section>
    </div>
  `;
}

function renderIntegrations() {
  const integrations = state.result.blueprint.integrations;
  if (!integrations.length) return '<div class="empty-state">No integration needs were derived from this process scope.</div>';

  return `
    <div class="canvas-inner integration-view">
      ${integrations.map((integration) => {
        const analysis = integration.decisionAnalysis;
        const preferredAlternatives = analysis?.alternatives?.filter((item) => item.fit === 'preferred').length ?? 0;
        return `
          <button class="integration-card${selectedClass(integration.id)}" type="button" data-object-id="${html(integration.id)}">
            <div class="integration-top">
              <div>
                <p class="eyebrow">${html(integration.mode)} · ${html(dataLabel(integration.dataObject))}</p>
                <h3>${html(integration.name)}</h3>
              </div>
              <div class="integration-decision-stack">
                ${decisionState(integration)}
                <span class="pattern-chip${patternClass(integration.patternId)}">${html(integration.patternName)}</span>
              </div>
            </div>
            <div class="integration-route">
              <span class="route-box">${html(systemLabel(integration.source))}</span>
              <span class="route-line" aria-hidden="true"></span>
              <span class="route-box">${html(systemLabel(integration.target))}</span>
            </div>
            <p class="integration-reason">${html(integration.because.join(' · '))}</p>
            <div class="integration-meta">
              <span>${analysis?.alternatives?.length ?? 0} alternatives evaluated</span>
              ${preferredAlternatives ? `<span>${preferredAlternatives} other preferred fit</span>` : '<span>one leading fit</span>'}
            </div>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderData() {
  const items = state.result.blueprint.dataObjects;
  return `
    <div class="canvas-inner">
      <section class="architecture-layer">
        <div class="layer-label"><strong>Data</strong><small>Business objects and authoritative ownership decisions.</small></div>
        <div class="layer-content">
          <div class="data-grid">
            ${items.map((item) => `
              <button class="data-card${selectedClass(item.id)}" type="button" data-object-id="${html(item.id)}">
                <p class="eyebrow">Business object</p>
                <strong>${html(item.name)}</strong>
                <div class="data-owner">
                  <span>System of record</span>
                  <b class="${item.owner ? '' : 'missing'}">${html(item.owner ? systemLabel(item.owner) : 'UNRESOLVED')}</b>
                </div>
              </button>
            `).join('')}
          </div>
        </div>
      </section>
    </div>
  `;
}

function transitionInstanceCard(item, column) {
  const current = item.states?.includes('current');
  const target = item.states?.includes('target');
  return `
    <button class="transition-node ${html(column)}${selectedClass(item.id)}" type="button" data-transition-id="${html(item.id)}">
      <span class="object-kind">${html(item.kind ?? 'instance')}</span>
      <strong>${html(item.name ?? item.id)}</strong>
      <small>${html(item.roleId ?? item.targetIntegrationId ?? item.id)}</small>
      <span class="state-strip">
        ${current ? '<i class="state-dot current">current</i>' : ''}
        ${item.states?.includes('transition') ? '<i class="state-dot transition">transition</i>' : ''}
        ${target ? '<i class="state-dot target">target</i>' : ''}
      </span>
    </button>
  `;
}

function renderTransition() {
  const transition = state.result.transition;
  if (!transition) {
    return `
      <div class="empty-state transition-empty">
        <strong>No application-instance transition loaded.</strong>
        <span>Use “Load WMS replacement” in the Context panel to model current → transition → target.</span>
      </div>
    `;
  }

  const currentOnly = transition.systems.filter((item) => item.states.includes('current') && !item.states.includes('target'));
  const kept = transition.systems.filter((item) => item.states.includes('current') && item.states.includes('target'));
  const targets = transition.systems.filter((item) => !item.states.includes('current') && item.states.includes('target'));

  return `
    <div class="canvas-inner transition-view">
      <div class="transition-summary">
        <span><b>${transition.replacements.length}</b> replacements</span>
        <span><b>${transition.coexistenceWindows.length}</b> coexistence windows</span>
        <span><b>${state.result.metrics.transitionIntegrationCount ?? 0}</b> integration instances</span>
      </div>
      <div class="transition-board">
        <section>
          <header><span>01</span><strong>Current</strong><small>Instances that exist now</small></header>
          <div class="transition-stack">${[...kept, ...currentOnly].map((item) => transitionInstanceCard(item, 'current')).join('')}</div>
        </section>
        <section class="transition-center">
          <header><span>02</span><strong>Transition</strong><small>Replacement & coexistence</small></header>
          <div class="replacement-stack">
            ${transition.replacements.length ? transition.replacements.map((item) => `
              <article class="replacement-card">
                <span class="replacement-kind">${html(item.kind)}</span>
                <strong>${html(item.currentId)}</strong>
                <span class="replacement-arrow">→</span>
                <strong>${html(item.targetId)}</strong>
                <small>${html((item.ruleIds ?? []).join(' · '))}</small>
              </article>
            `).join('') : '<div class="empty-mini">No replacements; current instances are kept or target-only.</div>'}
          </div>
        </section>
        <section>
          <header><span>03</span><strong>Target</strong><small>Instances after migration</small></header>
          <div class="transition-stack">${[...kept, ...targets].map((item) => transitionInstanceCard(item, 'target')).join('')}</div>
        </section>
      </div>
      <section class="transition-integrations">
        <div class="layer-label"><strong>Integration transition</strong><small>Current and target interface instances stay separately identifiable.</small></div>
        <div class="transition-integration-grid">
          ${transition.integrations.map((item) => `
            <article class="transition-integration-card">
              <span class="object-kind">${html(item.intent)}</span>
              <strong>${html(item.name)}</strong>
              <small>${html(item.id)}</small>
            </article>
          `).join('')}
        </div>
      </section>
    </div>
  `;
}

function renderRoadmap() {
  const roadmap = buildDeliveryRoadmap(state.result);
  return `
    <div class="canvas-inner roadmap-v2">
      <div class="roadmap-summary-bar">
        <span><b>${roadmap.summary.packageCount}</b> work packages</span>
        <span><b>${roadmap.summary.waveCount}</b> dependency waves</span>
        <span><b>${roadmap.summary.conditionalCount}</b> conditional</span>
        ${roadmap.summary.migrationPackageCount ? `<span><b>${roadmap.summary.migrationPackageCount}</b> migration</span>` : ''}
      </div>
      <div class="wave-track">
        ${roadmap.waves.map((wave) => `
          <section class="wave-column">
            <header><span>Wave ${wave.wave}</span><small>${wave.packageIds.length} items</small></header>
            <div class="wave-stack">
              ${wave.packageIds.map((id) => {
                const item = roadmap.packages.find((candidate) => candidate.id === id);
                return `
                  <article class="work-card-v2 ${item.classification}">
                    <div class="work-meta"><span>${html(item.phase)}</span><span>${html(item.classification)}</span></div>
                    <strong>${html(item.title)}</strong>
                    <p>${html(item.rationale)}</p>
                    <small>${item.dependsOn.length ? `after ${html(item.dependsOn.join(' · '))}` : 'starts after architecture intake'}</small>
                  </article>
                `;
              }).join('')}
            </div>
          </section>
        `).join('')}
      </div>
    </div>
  `;
}

function deltaObjectLabel(change) {
  const item = change.after ?? change.before ?? {};
  return item.name ?? item.title ?? (item.currentId && item.targetId ? `${item.currentId} → ${item.targetId}` : change.id);
}

function deltaChangeCard(change) {
  const focusId = ['work-package', 'replacement'].includes(change.kind) || !change.after ? '' : change.id;
  const beforeState = change.before?.state ? ` · ${change.before.state}` : '';
  const afterState = change.after?.state ? ` · ${change.after.state}` : '';
  const stateLine = change.change === 'changed' && (beforeState || afterState)
    ? `<p class="integration-reason">${html(`${beforeState.replace(' · ', '') || '—'} → ${afterState.replace(' · ', '') || '—'}`)}</p>`
    : '';

  return `
    <button class="integration-card delta-card" type="button" ${focusId ? `data-object-id="${html(focusId)}"` : 'disabled'}>
      <div class="integration-top">
        <div>
          <p class="eyebrow">${html(change.kind)} · ${html(change.id)}</p>
          <h3>${html(deltaObjectLabel(change))}</h3>
        </div>
        <span class="pattern-chip${change.change === 'added' ? ' event' : change.change === 'removed' ? ' partner' : ''}">${html(change.change)}</span>
      </div>
      ${stateLine}
      <p class="integration-reason">trace: ${html(change.because.length ? change.because.join(' · ') : 'structural comparison')}</p>
    </button>
  `;
}

function renderDelta() {
  if (!state.delta) return '<div class="empty-state">Set a baseline to start a What-if comparison.</div>';
  const { summary, changes } = state.delta;
  const groups = ['added', 'changed', 'removed'];

  return `
    <div class="canvas-inner">
      <section class="architecture-layer">
        <div class="layer-label"><strong>What if?</strong><small>Baseline stays frozen while you change business, NFR or migration context.</small></div>
        <div class="layer-content">
          <div class="metric-grid metric-grid-5">
            <div class="metric"><b>${summary.added}</b><span>Added</span></div>
            <div class="metric"><b>${summary.changed}</b><span>Changed</span></div>
            <div class="metric"><b>${summary.removed}</b><span>Removed</span></div>
            <div class="metric"><b>${summary.replacements ?? 0}</b><span>Replacements</span></div>
            <div class="metric"><b>${summary.total}</b><span>Total delta</span></div>
          </div>
        </div>
      </section>
      ${groups.map((group) => {
        const items = changes.filter((item) => item.change === group);
        if (!items.length) return '';
        return `
          <section class="architecture-layer">
            <div class="layer-label"><strong>${html(group)}</strong><small>${items.length} architecture/delivery changes.</small></div>
            <div class="layer-content"><div class="integration-view">${items.map(deltaChangeCard).join('')}</div></div>
          </section>
        `;
      }).join('') || '<div class="empty-state">No architecture delta. The current context matches the baseline.</div>'}
    </div>
  `;
}

function renderCanvas() {
  if (!state.result) {
    canvas.innerHTML = '<div class="empty-state">Select at least one business process to compose a blueprint.</div>';
    return;
  }

  const renderers = {
    blueprint: renderBlueprint,
    integrations: renderIntegrations,
    data: renderData,
    transition: renderTransition,
    roadmap: renderRoadmap,
    delta: renderDelta
  };
  canvas.innerHTML = renderers[state.view]();
}

function recommendationDecisionLabel(recommendation) {
  if (recommendation.decision?.startsWith('pattern.')) return patternLabel(recommendation.decision);
  if (recommendation.decision?.startsWith('sys.')) return systemLabel(recommendation.decision);
  return recommendation.decision;
}

function ruleChips(ruleIds = []) {
  return `<span class="rule-row">${ruleIds.map((id) => `<span class="rule-chip">${html(id)}</span>`).join('')}</span>`;
}

function findingCard(finding) {
  const focusId = finding.objectIds?.find((id) => id.startsWith('sys.') || id.startsWith('data.') || id.startsWith('integration.')) ?? '';
  return `
    <div class="finding-card" ${focusId ? `data-focus-id="${html(focusId)}"` : ''}>
      <div class="finding-head">
        <strong>${html(finding.nextDecision ?? finding.message)}</strong>
        <span class="severity-chip ${html(finding.severity)}">${html(finding.severity)}</span>
      </div>
      <p>${html(finding.message)}</p>
      ${ruleChips(finding.ruleIds)}
    </div>
  `;
}

function renderSummary() {
  if (!state.result) {
    decisionSummary.innerHTML = '';
    return;
  }
  const m = state.result.metrics;
  decisionSummary.innerHTML = `
    <div class="metric-grid metric-grid-5">
      <div class="metric"><b>${m.systemCount}</b><span>System roles</span></div>
      <div class="metric"><b>${m.integrationCount}</b><span>Integrations</span></div>
      <div class="metric"><b>${m.findingCount}</b><span>Findings</span></div>
      <div class="metric"><b>${m.workPackageCount}</b><span>Work packages</span></div>
      <div class="metric"><b>${m.replacementCount ?? 0}</b><span>Replacements</span></div>
    </div>
  `;
}

function renderDefaultDecisionDetail() {
  const result = state.result;
  const warnings = result.findings.filter((item) => item.severity !== 'info');
  const informational = result.findings.filter((item) => item.severity === 'info');
  const deltaNote = state.delta?.summary.total
    ? `<p class="detail-copy"><strong>What-if:</strong> ${state.delta.summary.added} added, ${state.delta.summary.changed} changed, ${state.delta.summary.removed} removed${state.delta.summary.replacements ? `, ${state.delta.summary.replacements} replacements` : ''} vs baseline.</p>`
    : '';

  decisionDetail.innerHTML = `
    <div>
      <p class="eyebrow">Architecture review</p>
      <h3 class="detail-title">${warnings.length} decisions or gaps need attention</h3>
      <p class="detail-copy">Composer does not guess missing architecture facts. Select an object on the canvas to inspect its rule trace, alternatives and delivery impact.</p>
      ${deltaNote}
    </div>
    <section class="decision-section">
      <h3>Decisions & gaps</h3>
      <div class="finding-list">${warnings.length ? warnings.slice(0, 10).map(findingCard).join('') : '<p class="detail-copy">No warning-level architecture gaps in this composition.</p>'}</div>
    </section>
    <section class="decision-section">
      <h3>Operational consequences</h3>
      <div class="finding-list">${informational.length ? informational.slice(0, 6).map(findingCard).join('') : '<p class="detail-copy">No additional operational findings.</p>'}</div>
    </section>
  `;
}

function findTransitionObject(id) {
  if (!state.result?.transition) return null;
  const collections = ['systems', 'integrations', 'replacements', 'dependencies', 'coexistenceWindows'];
  for (const collection of collections) {
    const object = state.result.transition[collection]?.find((item) => item.id === id);
    if (object) return object;
  }
  return null;
}

function explainSelection(id) {
  const base = explainObject(state.result, id);
  if (base.object) return base;
  const transitionObject = findTransitionObject(id);
  if (!transitionObject) return base;
  return {
    object: transitionObject,
    recommendations: [],
    findings: state.result.findings.filter((item) => item.objectIds?.includes(id)),
    workPackages: state.result.workPackages.filter((item) => item.sourceIds?.includes(id))
  };
}

function alternativeAnalysis(recommendation) {
  if (!recommendation.alternativeAnalysis?.length) return '';
  return `
    <div class="alternative-list">
      ${recommendation.alternativeAnalysis.map((item) => `
        <div class="alternative-row">
          <span class="fit-chip ${html(item.fit)}">${html(item.fit)}</span>
          <div><strong>${html(item.label)}</strong><small>${html(item.tradeoffs.length ? item.tradeoffs.join(' · ') : item.because.join(' · ') || 'viable alternative')}</small></div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderSelectedDecisionDetail() {
  const explanation = explainSelection(state.selectedId);
  if (!explanation.object) {
    state.selectedId = null;
    renderDefaultDecisionDetail();
    return;
  }

  const object = explanation.object;
  const reasons = object.reasonIds ?? object.ruleIds ?? [];
  const objectName = object.name ?? (object.currentId && object.targetId ? `${object.currentId} → ${object.targetId}` : object.id);

  decisionDetail.innerHTML = `
    <div>
      <p class="eyebrow">${html(object.kind ?? 'architecture object')}</p>
      <h3 class="detail-title">${html(objectName)}</h3>
      <div class="detail-id">${html(object.id)}</div>
      ${object.description ? `<p class="detail-copy">${html(object.description)}</p>` : ''}
      ${object.states ? `<div class="state-strip detail-states">${object.states.map((item) => `<i class="state-dot ${html(item)}">${html(item)}</i>`).join('')}</div>` : ''}
      ${reasons.length ? `<div class="decision-section"><h3>Why it exists</h3>${ruleChips(reasons)}</div>` : ''}
    </div>
    <section class="decision-section">
      <h3>Recommendations</h3>
      <div class="reason-list">
        ${explanation.recommendations.length ? explanation.recommendations.map((recommendation) => `
          <article class="reason-card">
            <span class="confidence-tag ${html(recommendation.confidence)}">${html(recommendation.confidence)}</span>
            <strong>${html(recommendationDecisionLabel(recommendation))}</strong>
            <p>${html(recommendation.because.join(' · '))}</p>
            ${ruleChips(recommendation.ruleIds)}
            ${alternativeAnalysis(recommendation)}
          </article>
        `).join('') : '<p class="detail-copy">This object is directly implied by scope or transition intent rather than a separate recommendation rule.</p>'}
      </div>
    </section>
    <section class="decision-section">
      <h3>Findings</h3>
      <div class="finding-list">${explanation.findings.length ? explanation.findings.map(findingCard).join('') : '<p class="detail-copy">No current findings are attached to this object.</p>'}</div>
    </section>
    <section class="decision-section">
      <h3>Delivery impact</h3>
      <div class="reason-list">
        ${explanation.workPackages.length ? explanation.workPackages.map((work) => `
          <article class="reason-card">
            <strong>${html(work.title)}</strong>
            <p>${html(work.phase)}${work.dependsOn.length ? ` · after ${html(work.dependsOn.join(', '))}` : ''}</p>
          </article>
        `).join('') : '<p class="detail-copy">No dedicated work package is derived from this object yet.</p>'}
      </div>
    </section>
  `;
}

function renderDecisionDetail() {
  if (!state.result) {
    decisionDetail.innerHTML = '<p class="detail-copy">Choose process scope to start architecture composition.</p>';
    return;
  }
  if (state.selectedId) renderSelectedDecisionDetail();
  else renderDefaultDecisionDetail();
}

function renderAll() {
  renderCanvas();
  renderSummary();
  renderDecisionDetail();
}

function updateDelta() {
  state.delta = state.baselineResult && state.result
    ? diffCompositions(state.baselineResult, state.result)
    : null;
}

function composeFromForm() {
  const context = readContext();
  if (!context.processes.length) {
    state.result = null;
    state.selectedId = null;
    state.delta = null;
    renderAll();
    return;
  }

  try {
    state.result = composeArchitecture(context);
    if (!state.baselineResult) state.baselineResult = composeArchitecture(context);
    updateDelta();
    if (state.selectedId) {
      const explanation = explainSelection(state.selectedId);
      if (!explanation.object) state.selectedId = null;
    }
    renderAll();
  } catch (error) {
    state.result = null;
    state.delta = null;
    canvas.innerHTML = `<div class="empty-state">${html(error.message)}</div>`;
    decisionSummary.innerHTML = '';
    decisionDetail.innerHTML = '';
  }
}

function setView(view) {
  state.view = view;
  viewTabs.forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  renderCanvas();
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

form.addEventListener('input', composeFromForm);
form.addEventListener('change', composeFromForm);

canvas.addEventListener('click', (event) => {
  const target = event.target.closest('[data-object-id], [data-transition-id]');
  if (!target || target.disabled) return;
  state.selectedId = target.dataset.objectId ?? target.dataset.transitionId;
  renderAll();
});

decisionDetail.addEventListener('click', (event) => {
  const target = event.target.closest('[data-focus-id]');
  if (!target?.dataset.focusId) return;
  state.selectedId = target.dataset.focusId;
  renderAll();
});

for (const tab of viewTabs) {
  tab.addEventListener('click', () => setView(tab.dataset.view));
}

baselineButton.addEventListener('click', () => {
  if (!state.result) return;
  state.baselineResult = composeArchitecture(readContext());
  state.selectedId = null;
  updateDelta();
  baselineButton.textContent = 'Baseline set';
  setTimeout(() => { baselineButton.textContent = 'Set baseline'; }, 900);
  renderAll();
});

loadTransitionButton.addEventListener('click', () => {
  applyTransitionScenario();
  state.selectedId = null;
  state.baselineResult = null;
  composeFromForm();
  setView('transition');
});

clearCurrentLandscapeButton.addEventListener('click', () => {
  state.currentLandscape = null;
  renderMigrationStatus();
  state.selectedId = null;
  composeFromForm();
});

exportBundleButton.addEventListener('click', () => {
  if (!state.result) return;
  downloadFile('enterprise-architecture.bundle.json', serializeBundle(createPortableBundle(state.result)), 'application/json');
});

exportReportButton.addEventListener('click', () => {
  if (!state.result) return;
  downloadFile('enterprise-architecture-report.md', bundleToMarkdown(createPortableBundle(state.result)), 'text/markdown');
});

resetButton.addEventListener('click', () => {
  applyDefaultScenario();
  state.selectedId = null;
  state.view = 'blueprint';
  state.baselineResult = null;
  composeFromForm();
  state.baselineResult = composeArchitecture(readContext());
  updateDelta();
  setView('blueprint');
});

renderProcessOptions();
applyDefaultScenario();
composeFromForm();
state.baselineResult = composeArchitecture(readContext());
updateDelta();
renderAll();
