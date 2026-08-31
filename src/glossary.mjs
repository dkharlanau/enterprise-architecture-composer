import {
  CATALOG_VERSION,
  capabilities,
  systems,
  dataObjects,
  integrationPatterns,
  processes
} from './catalog.mjs';

const CURATED_ALIASES = {
  'cap.customer-management': ['customer management', 'customer lifecycle'],
  'cap.order-management': ['order management', 'sales order management', 'order'],
  'cap.fulfilment': ['fulfillment', 'order fulfilment', 'order fulfillment'],
  'cap.billing': ['billing', 'invoicing'],
  'cap.supplier-management': ['supplier management', 'vendor management'],
  'cap.procurement': ['procurement', 'purchasing'],
  'cap.production-planning': ['production planning', 'manufacturing planning'],
  'cap.production-execution': ['production execution', 'manufacturing execution'],
  'cap.warehouse-management': ['warehouse management', 'warehouse'],
  'cap.transport-management': ['transport management', 'transportation management'],
  'cap.finance': ['finance', 'financial accounting'],
  'cap.master-data': ['master data', 'master data governance'],
  'cap.analytics': ['analytics', 'analytical reporting'],
  'cap.returns-management': ['returns management', 'returns'],
  'cap.intercompany': ['intercompany', 'cross-company'],

  'sys.crm': ['crm', 'customer relationship management'],
  'sys.erp': ['erp', 'enterprise resource planning'],
  'sys.mdm': ['mdm', 'master data management'],
  'sys.wms': ['wms', 'warehouse management system', 'warehouse'],
  'sys.mes': ['mes', 'manufacturing execution system'],
  'sys.tms': ['tms', 'transportation management system'],
  'sys.integration': ['integration platform', 'middleware', 'integration layer'],
  'sys.data-platform': ['data platform', 'analytics platform'],
  'sys.partner-edge': ['partner edge', 'b2b edge', 'trading partner boundary'],

  'data.customer': ['customer', 'customer master'],
  'data.product': ['product', 'material', 'product material'],
  'data.supplier': ['supplier', 'vendor', 'supplier master'],
  'data.price': ['price', 'pricing'],
  'data.sales-order': ['sales order', 'customer order', 'order'],
  'data.purchase-order': ['purchase order', 'po'],
  'data.delivery': ['delivery', 'outbound delivery'],
  'data.inventory': ['inventory', 'stock'],
  'data.production-order': ['production order', 'manufacturing order'],
  'data.invoice': ['invoice', 'billing document'],

  'pattern.sync-api': ['synchronous api', 'sync api', 'request response', 'request-response'],
  'pattern.async-message': ['asynchronous message', 'async message', 'message driven', 'message-driven'],
  'pattern.domain-event': ['domain event', 'business event', 'event driven', 'event-driven'],
  'pattern.edi-b2b': ['edi', 'b2b', 'edi b2b', 'partner document exchange'],
  'pattern.batch-file': ['batch file', 'file batch', 'file transfer', 'scheduled batch'],
  'pattern.cdc': ['cdc', 'change data capture', 'replication'],
  'pattern.etl-elt': ['etl', 'elt', 'etl elt', 'analytical pipeline'],

  'process.order-to-cash': ['order to cash', 'order-to-cash', 'o2c', 'otc'],
  'process.procure-to-pay': ['procure to pay', 'procure-to-pay', 'p2p'],
  'process.plan-to-produce': ['plan to produce', 'plan-to-produce', 'p2p production', 'manufacturing flow'],
  'process.returns': ['returns process', 'returns'],
  'process.intercompany': ['intercompany process', 'cross-company process'],
  'process.record-to-report': ['record to report', 'record-to-report', 'r2r']
};

const COLLECTIONS = [
  ['capability', capabilities],
  ['system-role', systems],
  ['data-object', dataObjects],
  ['integration-pattern', integrationPatterns],
  ['process', processes]
];

function normalizeAlias(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\/_.-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function localId(id) {
  return id.split('.').slice(1).join('.');
}

function aliasesFor(item) {
  const aliases = new Set([
    item.name,
    localId(item.id),
    ...(item.key ? [item.key] : []),
    ...(CURATED_ALIASES[item.id] ?? [])
  ]);
  return [...aliases]
    .map(normalizeAlias)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export function buildGlossary() {
  const entries = COLLECTIONS.flatMap(([kind, collection]) => collection.map((item) => ({
    id: item.id,
    kind,
    name: item.name,
    definition: item.description,
    aliases: aliasesFor(item),
    provenance: {
      catalogVersion: CATALOG_VERSION,
      source: 'enterprise-architecture-composer/reference-catalog'
    }
  }))).sort((a, b) => a.id.localeCompare(b.id));

  return {
    schemaVersion: '0.1',
    catalogVersion: CATALOG_VERSION,
    entries
  };
}

export function glossaryEntryById(id, glossary = buildGlossary()) {
  return glossary.entries.find((entry) => entry.id === id) ?? null;
}

export function resolveGlossaryAlias(value, options = {}, glossary = buildGlossary()) {
  const alias = normalizeAlias(value);
  if (!alias) return { status: 'unknown', alias, candidates: [] };

  const kinds = options.kind
    ? new Set(Array.isArray(options.kind) ? options.kind : [options.kind])
    : null;

  const candidates = glossary.entries
    .filter((entry) => !kinds || kinds.has(entry.kind))
    .filter((entry) => entry.id === value || entry.aliases.includes(alias))
    .map((entry) => ({ id: entry.id, kind: entry.kind, name: entry.name }))
    .sort((a, b) => a.id.localeCompare(b.id));

  if (!candidates.length) return { status: 'unknown', alias, candidates: [] };
  if (candidates.length > 1) return { status: 'ambiguous', alias, candidates };
  return { status: 'resolved', alias, id: candidates[0].id, entry: candidates[0], candidates };
}

export function validateGlossary(glossary = buildGlossary()) {
  const errors = [];
  const ids = new Set();
  for (const entry of glossary.entries ?? []) {
    if (!entry.id || ids.has(entry.id)) errors.push(`Duplicate or missing glossary ID: ${entry.id ?? '<missing>'}`);
    ids.add(entry.id);
    if (!entry.name) errors.push(`Missing display name: ${entry.id}`);
    if (!entry.definition) errors.push(`Missing definition: ${entry.id}`);
    if (!Array.isArray(entry.aliases) || entry.aliases.length < 1) errors.push(`Missing aliases: ${entry.id}`);
    if (entry.aliases.some((alias) => alias !== normalizeAlias(alias))) errors.push(`Alias is not normalized: ${entry.id}`);
    if (!entry.provenance?.catalogVersion) errors.push(`Missing provenance: ${entry.id}`);
  }
  return { valid: errors.length === 0, errors, entryCount: glossary.entries?.length ?? 0 };
}
