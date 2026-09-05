import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { composeArchitecture } from '../src/composer.mjs';
import {
  importApplicationInventoryCsv,
  importBackstageEntities,
  importInterfaceAsCode,
  importInterfaceInventoryCsv,
  importProcessAsCode,
  mergeImportedConstraints,
  parseCsvRecords
} from '../src/import-landscape.mjs';

async function exampleText(path) {
  return readFile(new URL(`../examples/import/${path}`, import.meta.url), 'utf8');
}

test('CSV parser preserves quoted commas and escaped quotes', () => {
  const rows = parseCsvRecords('id,name\napp.1,"ERP, Europe"\napp.2,"CRM ""Core"""\n');
  assert.equal(rows[0].name, 'ERP, Europe');
  assert.equal(rows[1].name, 'CRM "Core"');
});

test('application inventory imports concrete instances with canonical role IDs and provenance', async () => {
  const imported = importApplicationInventoryCsv(await exampleText('application-inventory.csv'), { sourceId: 'inventory:apps' });
  assert.equal(imported.conflicts.length, 0);
  assert.equal(imported.currentLandscape.systems.length, 3);
  assert.deepEqual(imported.currentLandscape.systems.find((item) => item.id === 'app.legacy-wms'), {
    id: 'app.legacy-wms',
    name: 'Legacy WMS',
    roleId: 'sys.wms',
    strategy: 'replace',
    replacementRoleId: 'sys.wms',
    notes: 'Replace warehouse execution instance'
  });
  assert.ok(imported.facts.every((item) => item.provenance.sourceType === 'csv'));
  assert.ok(imported.facts.every((item) => Number.isInteger(item.provenance.row)));
});

test('typed application role resolves an alias that is ambiguous in the global glossary', () => {
  const imported = importApplicationInventoryCsv('id,name,role\napp.warehouse,Warehouse Platform,warehouse\n');
  assert.equal(imported.conflicts.length, 0);
  assert.deepEqual(imported.currentLandscape.systems, [{
    id: 'app.warehouse',
    name: 'Warehouse Platform',
    roleId: 'sys.wms',
    strategy: 'undecided'
  }]);
});

test('interface inventory retains target integration mapping and source-row provenance', async () => {
  const imported = importInterfaceInventoryCsv(await exampleText('interface-inventory.csv'));
  const wms = imported.currentLandscape.integrations.find((item) => item.id === 'if.erp-wms');
  assert.equal(wms.strategy, 'replace');
  assert.equal(wms.targetIntegrationId, 'integration.delivery-to-warehouse');
  assert.ok(imported.facts.find((item) => item.subjectId === 'if.erp-wms').provenance.row >= 2);
});

test('Backstage uses the typed Composer system-role namespace and keeps entity provenance', async () => {
  const entities = JSON.parse(await exampleText('backstage-entities.json'));
  const imported = importBackstageEntities(entities);
  assert.equal(imported.currentLandscape.systems.length, 2);
  assert.equal(imported.currentLandscape.systems.find((item) => item.id === 'app.finance-erp').roleId, 'sys.erp');
  assert.equal(imported.currentLandscape.systems.find((item) => item.id === 'app.backstage.warehouse-platform').roleId, 'sys.wms');
  assert.equal(imported.conflicts.length, 0);
  assert.ok(imported.facts.some((item) => item.provenance.entityRef.includes('system:default/finance-erp')));
  assert.ok(imported.facts.some((item) => item.provenance.entityRef.includes('system:default/warehouse-platform')));
});

test('Backstage still requires an explicit Composer role annotation before importing an instance', () => {
  const imported = importBackstageEntities([{
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: { name: 'unmapped-system', annotations: {} }
  }]);
  assert.equal(imported.currentLandscape.systems.length, 0);
  assert.equal(imported.conflicts.length, 1);
  assert.equal(imported.conflicts[0].status, 'unknown');
});

test('Process-as-Code import can add recognized process scope without inventing application instances', () => {
  const imported = importProcessAsCode({
    version: '0.2',
    process: { id: 'process.order-to-cash', name: 'Order to Cash' },
    systems: [{ id: 'sys.crm', name: 'CRM' }, { id: 'sys.erp', name: 'ERP' }],
    steps: [{ id: 'start', name: 'Start' }]
  }, { sourceId: 'github://process-as-code/o2c' });
  assert.deepEqual(imported.processes, ['order-to-cash']);
  assert.equal(imported.currentLandscape.systems.length, 0);
  assert.ok(imported.facts.some((item) => item.kind === 'process-scope'));
  assert.ok(imported.facts.some((item) => item.kind === 'declared-logical-system'));
});

test('Interface-as-Code import stays evidence when endpoint systems are not known Composer roles', () => {
  const imported = importInterfaceAsCode({
    version: '1.0',
    interface: {
      id: 'ORDER-API-01',
      name: 'Order API',
      source: { system: 'Sales Portal' },
      target: { system: 'ERP' },
      mode: 'sync',
      pattern: 'request-response'
    },
    contract: { format: 'REST' }
  });
  assert.equal(imported.currentLandscape.systems.length, 0);
  assert.ok(imported.conflicts.some((item) => item.value === 'Sales Portal'));
  assert.ok(imported.facts.some((item) => item.kind === 'operational-interface-contract'));
  assert.ok(imported.facts.some((item) => item.value.roleId === 'sys.erp'));
});

test('merged imports never silently overwrite conflicting existing instances', () => {
  const base = {
    processes: ['record-to-report'],
    currentLandscape: {
      systems: [{ id: 'app.erp', name: 'Existing ERP', roleId: 'sys.erp', strategy: 'keep' }],
      integrations: []
    }
  };
  const imported = importApplicationInventoryCsv('id,name,role,strategy\napp.erp,Imported ERP,CRM,keep\n');
  const merged = mergeImportedConstraints(base, [imported]);
  assert.equal(merged.context.currentLandscape.systems.find((item) => item.id === 'app.erp').roleId, 'sys.erp');
  assert.ok(merged.conflicts.some((item) => item.kind === 'merge-conflict'));
});

test('merged current landscape composes alongside target roles without deleting current instances', async () => {
  const apps = importApplicationInventoryCsv(await exampleText('application-inventory.csv'));
  const interfaces = importInterfaceInventoryCsv(await exampleText('interface-inventory.csv'));
  const merged = mergeImportedConstraints({ processes: ['order-to-cash'] }, [apps, interfaces]);
  assert.equal(merged.conflicts.length, 0);

  const result = composeArchitecture(merged.context);
  assert.ok(result.transition.systems.some((item) => item.id === 'app.legacy-wms'));
  assert.ok(result.transition.systems.some((item) => item.id === 'target.wms'));
  assert.ok(result.transition.replacements.some((item) => item.currentId === 'app.legacy-wms'));
  assert.ok(merged.evidence.some((item) => item.subjectId === 'app.legacy-wms'));
});
