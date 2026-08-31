import test from 'node:test';
import assert from 'node:assert/strict';
import { composeArchitecture } from '../src/engine.mjs';
import { buildDeliveryRoadmap, roadmapToMarkdown } from '../src/roadmap.mjs';

test('roadmap adds rationale, triggers, labels and deterministic waves', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash', 'procure-to-pay', 'plan-to-produce'],
    constraints: { highVolume: true, multiCompany: true, retainLegacyWms: true },
    existingSystems: ['erp', 'legacy-wms']
  });

  const first = buildDeliveryRoadmap(result);
  const second = buildDeliveryRoadmap(result);
  assert.deepEqual(first, second);
  assert.ok(first.summary.waveCount >= 2);
  assert.equal(first.summary.packageCount, result.workPackages.length);
  assert.ok(first.packages.every((item) => item.rationale.length > 10));
  assert.ok(first.packages.every((item) => item.trigger.length > 10));
  assert.ok(first.packages.every((item) => item.labels.includes(`phase:${item.phase}`)));
});

test('legacy WMS and partner security work are explicit conditional scope', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash', 'procure-to-pay'],
    constraints: { retainLegacyWms: true },
    existingSystems: ['erp', 'legacy-wms']
  });
  const roadmap = buildDeliveryRoadmap(result);

  assert.equal(roadmap.packages.find((item) => item.id === 'wp.cutover.wms-coexistence').classification, 'conditional');
  assert.equal(roadmap.packages.find((item) => item.id === 'wp.security.partner-boundary').classification, 'conditional');
  assert.ok(roadmap.summary.conditionalCount >= 2);
});

test('roadmap dependencies always reference existing packages', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash', 'record-to-report'],
    constraints: { highVolume: true }
  });
  const roadmap = buildDeliveryRoadmap(result);
  const ids = new Set(roadmap.packages.map((item) => item.id));

  for (const item of roadmap.packages) {
    for (const dependency of item.dependsOn) assert.ok(ids.has(dependency), `${item.id} -> ${dependency}`);
  }
});

test('roadmap Markdown is reviewable outside the UI', () => {
  const result = composeArchitecture({ processes: ['order-to-cash'] });
  const markdown = roadmapToMarkdown(buildDeliveryRoadmap(result));

  assert.match(markdown, /^# Architecture Delivery Roadmap/m);
  assert.match(markdown, /Trigger:/);
  assert.match(markdown, /Rationale:/);
  assert.match(markdown, /Depends on:/);
  assert.match(markdown, /Source objects:/);
});
