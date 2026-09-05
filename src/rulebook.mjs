export const RULEBOOK_VERSION = '0.2.2';

// The rulebook is the public inventory of deterministic architecture guidance.
// `implemented: true` means the current public Composer surface executes or emits the rule.
// Remaining rules are specified contracts for later increments; they are deliberately visible
// before implementation so backlog and fixtures can refer to stable IDs.
export const RULEBOOK = [
  { id: 'SCOPE-MULTICOMPANY-001', family: 'scope', implemented: true, maturity: 'fixture-backed', description: 'Multi-company operation requires explicit intercompany and master-data architecture scope.' },
  { id: 'SCOPE-MASTERDATA-001', family: 'scope', implemented: true, maturity: 'fixture-backed', description: 'Broad cross-process scope requires explicit shared master-data responsibility.' },
  { id: 'SCOPE-ANALYTICS-001', family: 'scope', implemented: false, maturity: 'experimental', description: 'Record-to-report or analytical decision scope requires an explicit analytical serving responsibility.' },
  { id: 'SCOPE-B2B-001', family: 'scope', implemented: false, maturity: 'experimental', description: 'External supplier/customer document exchange introduces an explicit partner-edge boundary.' },
  { id: 'SYS-INTEGRATION-001', family: 'system-role', implemented: true, maturity: 'fixture-backed', description: 'A high-volume or integration-rich landscape requires an explicit integration-platform responsibility.' },
  { id: 'SYS-CRM-001', family: 'system-role', implemented: false, maturity: 'experimental', description: 'Customer interaction scope may justify a distinct CRM responsibility when it is not owned by the transactional backbone.' },
  { id: 'SYS-WMS-001', family: 'system-role', implemented: false, maturity: 'experimental', description: 'Warehouse execution scope requires an explicit warehouse-management responsibility.' },
  { id: 'SYS-MES-001', family: 'system-role', implemented: false, maturity: 'experimental', description: 'Production execution scope requires an explicit manufacturing-execution responsibility.' },
  { id: 'SYS-DATA-001', family: 'system-role', implemented: false, maturity: 'experimental', description: 'Enterprise analytical consumption requires an explicit data-platform responsibility.' },
  { id: 'DATA-OWNER-001', family: 'data', implemented: true, maturity: 'fixture-backed', description: 'Every business-critical data object requires an explicit authoritative owner.' },
  { id: 'DATA-CUSTOMER-001', family: 'data', implemented: false, maturity: 'experimental', description: 'Customer identity shared across processes requires one authoritative master-data responsibility or an explicit federated ownership rule.' },
  { id: 'DATA-PRODUCT-001', family: 'data', implemented: false, maturity: 'experimental', description: 'Product/material identity shared by sales, procurement, production and warehouse processes requires explicit ownership.' },
  { id: 'DATA-INVENTORY-001', family: 'data', implemented: false, maturity: 'experimental', description: 'Inventory distributed across ERP and warehouse execution requires an explicit authoritative and reconciliation model.' },
  { id: 'INT-SYNC-001', family: 'integration', implemented: true, maturity: 'fixture-backed', description: 'Immediate business response favors synchronous request/response.' },
  { id: 'INT-B2B-001', family: 'integration', implemented: true, maturity: 'fixture-backed', description: 'Trading-partner document exchange favors a B2B/EDI boundary.' },
  { id: 'INT-ANALYTICS-001', family: 'integration', implemented: true, maturity: 'fixture-backed', description: 'Analytical publication favors ETL/ELT into a data platform.' },
  { id: 'INT-EVENT-001', family: 'integration', implemented: true, maturity: 'fixture-backed', description: 'A non-blocking business fact with multiple consumers favors a domain event.' },
  { id: 'INT-ASYNC-001', family: 'integration', implemented: true, maturity: 'fixture-backed', description: 'A non-blocking one-to-one state transfer favors asynchronous messaging.' },
  { id: 'INT-ASYNC-002', family: 'integration', implemented: true, maturity: 'fixture-backed', description: 'High-volume non-blocking transfer strengthens the case for asynchronous messaging.' },
  { id: 'INT-BATCH-001', family: 'integration', implemented: true, maturity: 'fixture-backed', description: 'Large-volume exchange with relaxed latency and bounded execution windows may favor file/batch transfer.' },
  { id: 'INT-CDC-001', family: 'integration', implemented: true, maturity: 'fixture-backed', description: 'Read-model or persistence replication with change propagation semantics may favor CDC/replication.' },
  { id: 'INT-NFR-CONFLICT-001', family: 'integration', implemented: true, maturity: 'fixture-backed', description: 'Conflicting non-functional drivers must be surfaced as an architecture decision instead of being hidden by a technology recommendation.' },
  { id: 'NFR-EXPLICIT-001', family: 'integration', implemented: true, maturity: 'fixture-backed', description: 'When strict NFR confirmation is enabled, critical integration drivers must be explicitly confirmed instead of relying silently on reference defaults.' },
  { id: 'OPS-ASYNC-001', family: 'operations', implemented: true, maturity: 'fixture-backed', description: 'Asynchronous flows require explicit replay, monitoring and reconciliation decisions.' },
  { id: 'OPS-IDEMPOTENCY-001', family: 'operations', implemented: false, maturity: 'experimental', description: 'Replayable at-least-once processing requires an idempotency or duplicate-handling decision.' },
  { id: 'OPS-ORDERING-001', family: 'operations', implemented: false, maturity: 'experimental', description: 'Business objects with sequence-sensitive updates require an explicit ordering strategy.' },
  { id: 'SEC-PARTNER-001', family: 'security', implemented: true, maturity: 'fixture-backed', description: 'A partner boundary requires explicit trust, identity and transport-security decisions.' },
  { id: 'SEC-PUBLIC-001', family: 'security', implemented: true, maturity: 'fixture-backed', description: 'Public-facing integration exposure requires explicit authentication, authorization, abuse controls, transport security and audit decisions.' },
  { id: 'SEC-PRIVATE-001', family: 'security', implemented: true, maturity: 'fixture-backed', description: 'A private network boundary still requires explicit segmentation, caller identity, authorization and ownership instead of implicit trust.' },
  { id: 'SEC-IDENTITY-001', family: 'security', implemented: true, maturity: 'fixture-backed', description: 'An identity or authentication boundary requires explicit issuer, credential propagation, authorization context and failure semantics.' },
  { id: 'SEC-PRIVILEGED-001', family: 'security', implemented: true, maturity: 'fixture-backed', description: 'Privileged integration requires explicit least-privilege, credential lifecycle, break-glass ownership and audit decisions.' },
  { id: 'SEC-SENSITIVE-001', family: 'security', implemented: true, maturity: 'fixture-backed', description: 'Sensitive or regulated data movement requires explicit access, encryption, masking/redaction and logging decisions.' },
  { id: 'SEC-RESIDENCY-001', family: 'security', implemented: true, maturity: 'fixture-backed', description: 'Explicit data residency constraints require validation of processing, storage, backup, support and observability locations.' },
  { id: 'SEC-AUDIT-001', family: 'security', implemented: true, maturity: 'fixture-backed', description: 'Security-relevant flows or data with audit requirements need explicit evidence production, retention, access and completeness decisions.' },
  { id: 'MIG-WMS-001', family: 'migration', implemented: true, maturity: 'fixture-backed', description: 'Retained legacy WMS requires an explicit coexistence and retirement boundary.' },
  { id: 'MIG-REPLACE-001', family: 'migration', implemented: true, maturity: 'fixture-backed', description: 'A replacement requires introduce-before-retire dependencies and an explicit coexistence window.' },
  { id: 'DECISION-ORPHAN-001', family: 'decision-governance', implemented: true, maturity: 'fixture-backed', description: 'A retained human decision whose source recommendation no longer exists must remain visible as reviewable decision drift.' },
  { id: 'QUALITY-CAPABILITY-001', family: 'quality', implemented: true, maturity: 'fixture-backed', description: 'Every in-scope capability needs at least one justified supporting system responsibility in the reference model.' },
  { id: 'QUALITY-PROCESS-INTEGRATION-001', family: 'quality', implemented: true, maturity: 'fixture-backed', description: 'A process spanning multiple system roles needs explicit handoffs that connect participating roles.' },
  { id: 'QUALITY-SYSTEM-JUSTIFICATION-001', family: 'quality', implemented: true, maturity: 'fixture-backed', description: 'Every target system responsibility must be justified by process scope, a deterministic rule or an explicit architecture recommendation.' },
  { id: 'DELIVERY-TEST-001', family: 'delivery', implemented: true, maturity: 'fixture-backed', description: 'Cross-system architecture requires end-to-end and failure-path test scope.' },
  { id: 'DELIVERY-CUTOVER-001', family: 'delivery', implemented: false, maturity: 'experimental', description: 'Stateful system replacement requires cutover checkpoints, reconciliation and rollback criteria.' }
];

export function ruleById(id) {
  return RULEBOOK.find((rule) => rule.id === id);
}

export function implementedRules() {
  return RULEBOOK.filter((rule) => rule.implemented);
}
