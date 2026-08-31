import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { composeArchitecture } from '../src/composer.mjs';
import { buildTransitionArchitecture } from '../src/transition.mjs';
import { createPortableBundle, verifyBundleRecomposition } from '../src/export.mjs';

async function replacementScenario() {
  const url = new URL('../examples/scenarios/legacy-wms-replacement.context.json', import.meta.url);
  return JSON.parse(await readFile(url, 'utf8'));
}

test('kept ERP and CRM remain current-to-target instances without duplicate target instances', async () => {
  const result = composeArchitecture(await replacementScenario());
  const systems = result.transition.systems;

  const erp = systems.find((item) => item.id === 'app.current-erp');
  const crm = systems.find((item) => item.id === 'app.current-crm');
  assert.deepEqual(erp.states, ['current', 'target']);
  assert.deepEqual(crm.states, ['current', 'target']);
  assert.equal(systems.some((item) => item.id === 'target.erp'), false);
  assert.equal(systems.some((item) => item.id === 'target.crm'), false);
});

test('legacy WMS replacement creates target instance, replacement and coexistence window', async () => {
  const result = composeArchitecture(await replacementScenario());
  const transition = result.transition;

  const legacy = transition.systems.find((item) => item.id === 'app.legacy-wms');
  const target = transition.systems.find((item) => item.id === 'target.wms');
  assert.deepEqual(legacy.states, ['current', 'transition']);
  assert.deepEqual(target.states, ['transition', 'target']);
  assert.deepEqual(target.replaces, ['app.legacy-wms']);
  assert.ok(transition.replacements.some((item) => item.currentId === 'app.legacy-wms' && item.targetId === 'target.wms'));
  assert.ok(transition.coexistenceWindows.some((item) => item.currentId === 'app.legacy-wms' && item.targetId === 'target.wms'));
});

test('replacement roadmap enforces introduce before coexist before retire', async () => {
  const result = composeArchitecture(await replacementScenario());
  const introduce = result.workPackages.find((item) => item.id === 'wp.transition.introduce.target.wms');
  const coexist = result.workPackages.find((item) => item.id === 'wp.transition.coexist.app.legacy-wms.target.wms');
  const retire = result.workPackages.find((item) => item.id === 'wp.transition.retire.app.legacy-wms');

  assert.ok(introduce);
  assert.deepEqual(coexist.dependsOn, [introduce.id]);
  assert.deepEqual(retire.dependsOn, [coexist.id]);
  assert.ok(result.transition.dependencies.some((item) => item.relation === 'introduce-before-retire'));
});

test('retiring a still-required role without replacement creates a warning', () => {
  const result = composeArchitecture({
    processes: ['order-to-cash'],
    currentLandscape: {
      systems: [
        { id: 'app.erp-old', name: 'Old ERP', roleId: 'sys.erp', strategy: 'retire' },
        { id: 'app.crm', name: 'CRM', roleId: 'sys.crm', strategy: 'keep' },
        { id: 'app.wms', name: 'WMS', roleId: 'sys.wms', strategy: 'keep' }
      ]
    }
  });
  assert.ok(result.findings.some((item) => item.id === 'transition.retire-required-role.app.erp-old'));
});

test('keeping an out-of-target role creates an explicit transition decision', () => {
  const result = composeArchitecture({
    processes: ['record-to-report'],
    currentLandscape: {
      systems: [
        { id: 'app.erp', name: 'ERP', roleId: 'sys.erp', strategy: 'keep' },
        { id: 'app.data', name: 'Data Platform', roleId: 'sys.data-platform', strategy: 'keep' },
        { id: 'app.old-wms', name: 'Old WMS', roleId: 'sys.wms', strategy: 'keep' }
      ]
    }
  });
  assert.ok(result.findings.some((item) => item.id === 'transition.keep-outside-target.app.old-wms'));
});

test('invalid current integration references fail explicitly', () => {
  const base = composeArchitecture({ processes: ['order-to-cash'] });
  assert.throws(() => buildTransitionArchitecture(base, {
    systems: [{ id: 'app.erp', name: 'ERP', roleId: 'sys.erp', strategy: 'keep' }],
    integrations: [{
      id: 'if.bad',
      name: 'Bad reference',
      sourceSystemId: 'app.erp',
      targetSystemId: 'app.missing',
      strategy: 'keep'
    }]
  }), /not present in currentLandscape\.systems/);
});

test('current integration replacement maps to composed target integration', async () => {
  const result = composeArchitecture(await replacementScenario());
  assert.ok(result.transition.replacements.some((item) =>
    item.kind === 'integration-replacement' &&
    item.currentId === 'if.legacy-wms-outbound' &&
    item.targetIntegrationId === 'integration.delivery-to-warehouse'
  ));
});

test('transition landscape survives portable bundle roundtrip', async () => {
  const result = composeArchitecture(await replacementScenario());
  const bundle = createPortableBundle(result);
  const verification = verifyBundleRecomposition(bundle);
  assert.equal(verification.matches, true);
  assert.deepEqual(verification.recomposed.transition, result.transition);
});
