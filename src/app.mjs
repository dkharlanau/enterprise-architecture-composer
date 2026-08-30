import { composeArchitecture, explainObject } from './engine.mjs';
import { processes, systems, dataObjects, integrationPatterns, byId } from './catalog.mjs';

const DEFAULT_SCENARIO = {
  processes: ['order-to-cash', 'procure-to-pay', 'plan-to-produce'],
  constraints: {
    multiCompany: true,
    highVolume: true,
    retainLegacyWms: true
  },
  existingSystems: ['erp', 'legacy-wms'],
  scale: { countries: 8, legalEntities: 12, plants: 4, warehouses: 11 }
};

const state = {
  view: 'blueprint',
  selectedId: null,
  result: null
};

const form = document.querySelector('#context-form');
const processOptions = document.querySelector('#process-options');
const canvas = document.querySelector('#canvas');
const decisionSummary = document.querySelector('#decision-summary');
const decisionDetail = document.querySelector('#decision-detail');
const resetButton = document.querySelector('#reset-demo');
const viewTabs = [...document.querySelectorAll('.view-tab')];

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
  setChecked('process', DEFAULT_SCENARIO.processes);
  setChecked('existingSystem', DEFAULT_SCENARIO.existingSystems);
  form.elements.multiCompany.checked = DEFAULT_SCENARIO.constraints.multiCompany;
  form.elements.highVolume.checked = DEFAULT_SCENARIO.constraints.highVolume;
  form.elements.retainLegacyWms.checked = DEFAULT_SCENARIO.constraints.retainLegacyWms;
  form.elements.countries.value = DEFAULT_SCENARIO.scale.countries;
  form.elements.legalEntities.value = DEFAULT_SCENARIO.scale.legalEntities;
  form.elements.plants.value = DEFAULT_SCENARIO.scale.plants;
  form.elements.warehouses.value = DEFAULT_SCENARIO.scale.warehouses;
}

function readContext() {
  const selectedProcesses = [...form.querySelectorAll('[name="process"]:checked')].map((input) => input.value);
  const existingSystems = [...form.querySelectorAll('[name="existingSystem"]:checked')].map((input) => input.value);

  return {
    industry: 'manufacturing',
    operatingModel: 'b2b',
    processes: selectedProcesses,
    constraints: {
      multiCompany: form.elements.multiCompany.checked,
      highVolume: form.elements.highVolume.checked,
      retainLegacyWms: form.elements.retainLegacyWms.checked
    },
    existingSystems,
    scale: {
      countries: form.elements.countries.value,
      legalEntities: form.elements.legalEntities.value,
      plants: form.elements.plants.value,
      warehouses: form.elements.warehouses.value
    }
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
  return '';
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
      <span class="pattern-chip${patternClass(integration.patternId)}">${html(integration.patternName)}</span>
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
        <div class="layer-label"><strong>Flow</strong><small>Cross-system needs with a pattern decision.</small></div>
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
      ${integrations.map((integration) => `
        <button class="integration-card${selectedClass(integration.id)}" type="button" data-object-id="${html(integration.id)}">
          <div class="integration-top">
            <div>
              <p class="eyebrow">${html(integration.mode)} · ${html(dataLabel(integration.dataObject))}</p>
              <h3>${html(integration.name)}</h3>
            </div>
            <span class="pattern-chip${patternClass(integration.patternId)}">${html(integration.patternName)}</span>
          </div>
          <div class="integration-route">
            <span class="route-box">${html(systemLabel(integration.source))}</span>
            <span class="route-line" aria-hidden="true"></span>
            <span class="route-box">${html(systemLabel(integration.target))}</span>
          </div>
          <p class="integration-reason">${html(integration.because.join(' · '))}</p>
        </button>
      `).join('')}
    </div>
  `;
}

function renderData() {
  const items = state.result.blueprint.dataObjects;
  return `
    <div class="canvas-inner">
      <section class="architecture-layer">
        <div class="layer-label"><strong>Data</strong><small>Business objects and current authoritative ownership decision.</small></div>
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

function renderRoadmap() {
  const groups = new Map();
  for (const work of state.result.workPackages) {
    if (!groups.has(work.phase)) groups.set(work.phase, []);
    groups.get(work.phase).push(work);
  }

  return `
    <div class="canvas-inner roadmap">
      ${[...groups.entries()].map(([phase, work]) => `
        <section class="roadmap-phase">
          <div class="phase-name">${html(phase)}</div>
          <div class="phase-work">
            ${work.map((item) => `
              <article class="work-card">
                <strong>${html(item.title)}</strong>
                <small>${item.dependsOn.length ? `after: ${html(item.dependsOn.join(' · '))}` : 'no upstream work-package dependency'}</small>
              </article>
            `).join('')}
          </div>
        </section>
      `).join('')}
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
    roadmap: renderRoadmap
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
  const focusId = finding.objectIds?.[0] ?? '';
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
    <div class="metric-grid">
      <div class="metric"><b>${m.capabilityCount}</b><span>Capabilities</span></div>
      <div class="metric"><b>${m.systemCount}</b><span>System roles</span></div>
      <div class="metric"><b>${m.integrationCount}</b><span>Integrations</span></div>
      <div class="metric"><b>${m.workPackageCount}</b><span>Work packages</span></div>
    </div>
  `;
}

function renderDefaultDecisionDetail() {
  const result = state.result;
  const questions = result.findings.filter((item) => item.kind === 'question' || item.kind === 'security-decision');
  const otherFindings = result.findings.filter((item) => !questions.includes(item));

  decisionDetail.innerHTML = `
    <div>
      <p class="eyebrow">Architecture review</p>
      <h3 class="detail-title">${questions.length} decisions still need an owner</h3>
      <p class="detail-copy">The composer does not guess missing architecture facts. Select an object on the canvas to inspect its rule trace.</p>
    </div>
    <section class="decision-section">
      <h3>Questions & boundaries</h3>
      <div class="finding-list">${questions.length ? questions.map(findingCard).join('') : '<p class="detail-copy">No blocking questions in this reference composition.</p>'}</div>
    </section>
    <section class="decision-section">
      <h3>Operational consequences</h3>
      <div class="finding-list">${otherFindings.slice(0, 6).map(findingCard).join('')}</div>
    </section>
  `;
}

function renderSelectedDecisionDetail() {
  const explanation = explainObject(state.result, state.selectedId);
  if (!explanation.object) {
    state.selectedId = null;
    renderDefaultDecisionDetail();
    return;
  }

  const object = explanation.object;
  const reasons = object.reasonIds ?? object.ruleIds ?? [];

  decisionDetail.innerHTML = `
    <div>
      <p class="eyebrow">${html(object.kind ?? 'architecture object')}</p>
      <h3 class="detail-title">${html(object.name ?? object.id)}</h3>
      <div class="detail-id">${html(object.id)}</div>
      ${object.description ? `<p class="detail-copy">${html(object.description)}</p>` : ''}
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
          </article>
        `).join('') : '<p class="detail-copy">This object is directly implied by process scope rather than a separate recommendation rule.</p>'}
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

function composeFromForm() {
  const context = readContext();
  if (!context.processes.length) {
    state.result = null;
    state.selectedId = null;
    renderAll();
    return;
  }

  try {
    state.result = composeArchitecture(context);
    if (state.selectedId) {
      const explanation = explainObject(state.result, state.selectedId);
      if (!explanation.object) state.selectedId = null;
    }
    renderAll();
  } catch (error) {
    state.result = null;
    canvas.innerHTML = `<div class="empty-state">${html(error.message)}</div>`;
    decisionSummary.innerHTML = '';
    decisionDetail.innerHTML = '';
  }
}

form.addEventListener('input', composeFromForm);
form.addEventListener('change', composeFromForm);

canvas.addEventListener('click', (event) => {
  const target = event.target.closest('[data-object-id]');
  if (!target) return;
  state.selectedId = target.dataset.objectId;
  renderAll();
});

decisionDetail.addEventListener('click', (event) => {
  const target = event.target.closest('[data-focus-id]');
  if (!target?.dataset.focusId) return;
  state.selectedId = target.dataset.focusId;
  renderAll();
});

for (const tab of viewTabs) {
  tab.addEventListener('click', () => {
    state.view = tab.dataset.view;
    viewTabs.forEach((item) => item.classList.toggle('active', item === tab));
    renderCanvas();
  });
}

resetButton.addEventListener('click', () => {
  applyDefaultScenario();
  state.selectedId = null;
  state.view = 'blueprint';
  viewTabs.forEach((item) => item.classList.toggle('active', item.dataset.view === 'blueprint'));
  composeFromForm();
});

renderProcessOptions();
applyDefaultScenario();
composeFromForm();
