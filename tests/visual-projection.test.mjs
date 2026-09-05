import test from 'node:test';
import assert from 'node:assert/strict';
import { composeArchitecture } from '../src/engine.mjs';
import { toVisualWorkbench, visualWorkbenchMarkdown } from '../src/visual-projection.mjs';

const allowedNodeTypes = new Set(['step', 'system', 'data', 'role', 'decision', 'checkpoint', 'milestone', 'outcome', 'risk', 'note']);
const allowedEdgeTypes = new Set(['flow', 'data', 'dependency', 'relation', 'control', 'exception']);
const allowedKinds = new Set(['process', 'plan', 'data-flow', 'relationship', 'system-flow', 'checkpoint-flow', 'roadmap', 'timeline', 'handoff', 'dependency-map']);

test('projection follows the published Visual Workbench semantic vocabulary', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash', 'procure-to-pay'],
    constraints: { multiCompany: true, highVolume: true }
  });
  const projection = toVisualWorkbench(result);
  const visual = projection.visual;

  assert.ok(visual.title.length > 0);
  assert.ok(allowedKinds.has(visual.kind));
  assert.ok(visual.nodes.length > 0);
  assert.ok(visual.nodes.every((node) => allowedNodeTypes.has(node.type)));
  assert.ok(visual.edges.every((edge) => allowedEdgeTypes.has(edge.type)));
  assert.ok(visual.views.every((view) => allowedKinds.has(view.kind)));
});

test('projection preserves Composer stable IDs as Visual Workbench node IDs', () => {
  const result = composeArchitecture({ processes: ['order-to-cash'] });
  const projection = toVisualWorkbench(result);
  const ids = new Set(projection.visual.nodes.map((node) => node.id));

  for (const system of result.blueprint.systems) assert.ok(ids.has(system.id));
  for (const data of result.blueprint.dataObjects) assert.ok(ids.has(data.id));
  for (const capability of result.blueprint.capabilities) assert.ok(ids.has(capability.id));
});

test('projection creates named executive, integration, data, security and exception views', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash', 'procure-to-pay'],
    constraints: { multiCompany: true }
  });
  const views = toVisualWorkbench(result).visual.views.map((view) => view.id);
  assert.deepEqual(views, ['executive', 'integration', 'data', 'security', 'exceptions']);
});

test('Markdown projection remains deterministic and coordinate-free', () => {
  const result = composeArchitecture({ processes: ['record-to-report'] });
  const first = visualWorkbenchMarkdown(toVisualWorkbench(result));
  const second = visualWorkbenchMarkdown(toVisualWorkbench(result));
  assert.equal(first, second);
  assert.doesNotMatch(first, /"x"\s*:/);
  assert.doesNotMatch(first, /"y"\s*:/);
  assert.match(first, /^---/);
});
