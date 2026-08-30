export const CATALOG_VERSION = '0.1.0';

export const capabilities = [
  ['cap.customer-management', 'Customer Management', 'Manage customer lifecycle, commercial context and relationships.'],
  ['cap.order-management', 'Order Management', 'Capture, validate and manage customer demand through order lifecycle.'],
  ['cap.fulfilment', 'Fulfilment', 'Plan and execute delivery of ordered products to customers.'],
  ['cap.billing', 'Billing', 'Create invoices and commercial settlement documents.'],
  ['cap.supplier-management', 'Supplier Management', 'Govern supplier identity, qualification and purchasing context.'],
  ['cap.procurement', 'Procurement', 'Source and purchase goods and services.'],
  ['cap.production-planning', 'Production Planning', 'Translate demand and supply constraints into production plans.'],
  ['cap.production-execution', 'Production Execution', 'Execute and report manufacturing operations.'],
  ['cap.warehouse-management', 'Warehouse Management', 'Control stock placement, picking, packing and warehouse movements.'],
  ['cap.transport-management', 'Transport Management', 'Plan and execute transportation and carrier handoffs.'],
  ['cap.finance', 'Finance', 'Record, reconcile and report financial outcomes.'],
  ['cap.master-data', 'Master Data', 'Govern shared enterprise business objects and ownership.'],
  ['cap.analytics', 'Analytics', 'Provide decision-ready analytical data products.'],
  ['cap.returns-management', 'Returns Management', 'Authorize, receive, inspect and settle returned goods.'],
  ['cap.intercompany', 'Intercompany', 'Coordinate transactions across legal entities in one operating model.']
].map(([id, name, description]) => ({ id, kind: 'capability', name, description }));

export const systems = [
  ['sys.crm', 'CRM', 'Customer interaction and commercial relationship system role.'],
  ['sys.erp', 'ERP', 'Transactional backbone for orders, procurement, inventory accounting and finance.'],
  ['sys.mdm', 'MDM', 'Authoritative governance role for shared master data.'],
  ['sys.wms', 'WMS', 'Warehouse execution system role.'],
  ['sys.mes', 'MES', 'Manufacturing execution system role.'],
  ['sys.tms', 'TMS', 'Transportation planning and execution system role.'],
  ['sys.integration', 'Integration Platform', 'Managed mediation, messaging, API and B2B integration role.'],
  ['sys.data-platform', 'Data Platform', 'Analytical ingestion, transformation and serving role.'],
  ['sys.partner-edge', 'Partner Edge', 'External trading-partner / B2B boundary.']
].map(([id, name, description]) => ({ id, kind: 'system-role', name, description }));

export const dataObjects = [
  ['data.customer', 'Customer', 'sys.mdm'],
  ['data.product', 'Product / Material', 'sys.mdm'],
  ['data.supplier', 'Supplier', 'sys.mdm'],
  ['data.price', 'Price', 'sys.erp'],
  ['data.sales-order', 'Sales Order', 'sys.erp'],
  ['data.purchase-order', 'Purchase Order', 'sys.erp'],
  ['data.delivery', 'Delivery', 'sys.erp'],
  ['data.inventory', 'Inventory', 'sys.erp'],
  ['data.production-order', 'Production Order', 'sys.erp'],
  ['data.invoice', 'Invoice', 'sys.erp']
].map(([id, name, defaultOwner]) => ({
  id,
  kind: 'data-object',
  name,
  defaultOwner,
  description: `${name} business object used by the reference manufacturing model.`
}));

export const integrationPatterns = [
  ['pattern.sync-api', 'Synchronous API', 'Request/response interaction where the caller needs an immediate business answer.'],
  ['pattern.async-message', 'Asynchronous Message', 'Reliable decoupled delivery to a known downstream consumer.'],
  ['pattern.domain-event', 'Domain Event', 'Publish a business fact for multiple independently evolving consumers.'],
  ['pattern.edi-b2b', 'EDI / B2B Exchange', 'Structured document exchange across a trading-partner boundary.'],
  ['pattern.batch-file', 'File / Batch', 'Scheduled bulk exchange where latency is not the primary driver.'],
  ['pattern.cdc', 'CDC / Replication', 'Propagate data changes to another persistence or read model.'],
  ['pattern.etl-elt', 'ETL / ELT', 'Move and transform data for analytical consumption.']
].map(([id, name, description]) => ({ id, kind: 'integration-pattern', name, description }));

const needs = {
  salesOrderRequest: {
    id: 'need.sales-order-request',
    name: 'Create sales order',
    source: 'sys.crm',
    target: 'sys.erp',
    dataObject: 'data.sales-order',
    immediateResponse: true,
    fanOut: 1,
    partnerBoundary: false,
    purpose: 'business-request'
  },
  deliveryToWarehouse: {
    id: 'need.delivery-to-warehouse',
    name: 'Release delivery to warehouse',
    source: 'sys.erp',
    target: 'sys.wms',
    dataObject: 'data.delivery',
    immediateResponse: false,
    fanOut: 1,
    partnerBoundary: false,
    purpose: 'state-transfer'
  },
  warehouseConfirmation: {
    id: 'need.warehouse-confirmation',
    name: 'Report warehouse execution',
    source: 'sys.wms',
    target: 'sys.erp',
    dataObject: 'data.delivery',
    immediateResponse: false,
    fanOut: 2,
    partnerBoundary: false,
    purpose: 'business-event'
  },
  purchaseOrderPartner: {
    id: 'need.purchase-order-partner',
    name: 'Exchange purchase order with supplier',
    source: 'sys.erp',
    target: 'sys.partner-edge',
    dataObject: 'data.purchase-order',
    immediateResponse: false,
    fanOut: 1,
    partnerBoundary: true,
    purpose: 'partner-document'
  },
  goodsReceipt: {
    id: 'need.goods-receipt',
    name: 'Report goods receipt and inventory change',
    source: 'sys.wms',
    target: 'sys.erp',
    dataObject: 'data.inventory',
    immediateResponse: false,
    fanOut: 2,
    partnerBoundary: false,
    purpose: 'business-event'
  },
  productionOrder: {
    id: 'need.production-order',
    name: 'Release production order',
    source: 'sys.erp',
    target: 'sys.mes',
    dataObject: 'data.production-order',
    immediateResponse: false,
    fanOut: 1,
    partnerBoundary: false,
    purpose: 'command'
  },
  productionConfirmation: {
    id: 'need.production-confirmation',
    name: 'Report production outcome',
    source: 'sys.mes',
    target: 'sys.erp',
    dataObject: 'data.production-order',
    immediateResponse: false,
    fanOut: 2,
    partnerBoundary: false,
    purpose: 'business-event'
  },
  returnsAuthorization: {
    id: 'need.returns-authorization',
    name: 'Authorize return',
    source: 'sys.crm',
    target: 'sys.erp',
    dataObject: 'data.sales-order',
    immediateResponse: true,
    fanOut: 1,
    partnerBoundary: false,
    purpose: 'business-request'
  },
  returnsReceipt: {
    id: 'need.returns-receipt',
    name: 'Report returned-goods receipt',
    source: 'sys.wms',
    target: 'sys.erp',
    dataObject: 'data.inventory',
    immediateResponse: false,
    fanOut: 2,
    partnerBoundary: false,
    purpose: 'business-event'
  },
  financeAnalytics: {
    id: 'need.finance-analytics',
    name: 'Publish finance data for analytics',
    source: 'sys.erp',
    target: 'sys.data-platform',
    dataObject: 'data.invoice',
    immediateResponse: false,
    fanOut: 1,
    partnerBoundary: false,
    purpose: 'analytics'
  }
};

export const processes = [
  {
    id: 'process.order-to-cash',
    kind: 'process',
    key: 'order-to-cash',
    name: 'Order to Cash',
    description: 'Customer demand through fulfilment, billing and settlement.',
    capabilityIds: ['cap.customer-management', 'cap.order-management', 'cap.fulfilment', 'cap.billing', 'cap.warehouse-management'],
    systemIds: ['sys.crm', 'sys.erp', 'sys.wms'],
    dataIds: ['data.customer', 'data.product', 'data.price', 'data.sales-order', 'data.delivery', 'data.invoice'],
    integrationNeeds: [needs.salesOrderRequest, needs.deliveryToWarehouse, needs.warehouseConfirmation]
  },
  {
    id: 'process.procure-to-pay',
    kind: 'process',
    key: 'procure-to-pay',
    name: 'Procure to Pay',
    description: 'Supplier purchasing through receipt, invoice and settlement.',
    capabilityIds: ['cap.supplier-management', 'cap.procurement', 'cap.warehouse-management', 'cap.finance'],
    systemIds: ['sys.erp', 'sys.wms', 'sys.partner-edge'],
    dataIds: ['data.supplier', 'data.product', 'data.purchase-order', 'data.inventory', 'data.invoice'],
    integrationNeeds: [needs.purchaseOrderPartner, needs.goodsReceipt]
  },
  {
    id: 'process.plan-to-produce',
    kind: 'process',
    key: 'plan-to-produce',
    name: 'Plan to Produce',
    description: 'Production planning through manufacturing execution and stock update.',
    capabilityIds: ['cap.production-planning', 'cap.production-execution', 'cap.warehouse-management'],
    systemIds: ['sys.erp', 'sys.mes', 'sys.wms'],
    dataIds: ['data.product', 'data.inventory', 'data.production-order'],
    integrationNeeds: [needs.productionOrder, needs.productionConfirmation]
  },
  {
    id: 'process.returns',
    kind: 'process',
    key: 'returns',
    name: 'Returns',
    description: 'Return authorization, receipt, inspection and commercial settlement.',
    capabilityIds: ['cap.returns-management', 'cap.customer-management', 'cap.warehouse-management', 'cap.billing'],
    systemIds: ['sys.crm', 'sys.erp', 'sys.wms'],
    dataIds: ['data.customer', 'data.sales-order', 'data.delivery', 'data.inventory', 'data.invoice'],
    integrationNeeds: [needs.returnsAuthorization, needs.returnsReceipt]
  },
  {
    id: 'process.intercompany',
    kind: 'process',
    key: 'intercompany',
    name: 'Intercompany',
    description: 'Coordinate commercial and logistical transactions between legal entities.',
    capabilityIds: ['cap.intercompany', 'cap.order-management', 'cap.procurement', 'cap.finance'],
    systemIds: ['sys.erp'],
    dataIds: ['data.sales-order', 'data.purchase-order', 'data.delivery', 'data.invoice'],
    integrationNeeds: []
  },
  {
    id: 'process.record-to-report',
    kind: 'process',
    key: 'record-to-report',
    name: 'Record to Report',
    description: 'Financial recording, close and analytical reporting.',
    capabilityIds: ['cap.finance', 'cap.analytics'],
    systemIds: ['sys.erp', 'sys.data-platform'],
    dataIds: ['data.invoice'],
    integrationNeeds: [needs.financeAnalytics]
  }
];

export const catalog = {
  version: CATALOG_VERSION,
  capabilities,
  systems,
  dataObjects,
  integrationPatterns,
  processes
};

export function byId(collection, id) {
  return collection.find((item) => item.id === id);
}

export function processByKey(key) {
  return processes.find((process) => process.key === key);
}
