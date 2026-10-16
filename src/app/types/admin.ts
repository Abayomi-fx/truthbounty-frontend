/**
 * Admin Operations & Governance Types — V2-FE-154
 *
 * Types for authorized admin system health, bounded operational queues,
 * audit references, and read-only protocol configuration.
 */

export type OperationRiskLevel = 'low' | 'medium' | 'high';
export type OperationAuthority = 'PROTOCOL_OPERATOR' | 'EMERGENCY_ADMIN' | 'AUDIT_ADMIN';
export type OperationalItemStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface OperationalQueueItem {
  id: string;
  title: string;
  description: string;
  authority: OperationAuthority;
  targetResource: string;
  risk: OperationRiskLevel;
  consequence: string;
  queueAge: string;
  createdAt: string;
  status: OperationalItemStatus;
}

export interface SystemHealthMetric {
  id: string;
  name: string;
  value: string;
  subtext?: string;
  status: 'healthy' | 'warning' | 'degraded' | 'unavailable';
  source: string;
  lastUpdated: string; // ISO 8601
}

export interface AdminAuditRecord {
  auditId: string;
  operator: string;
  action: string;
  authority: OperationAuthority;
  targetResource: string;
  consequenceHash: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILED' | 'CONFIRMED';
  details?: string;
}

export interface ReadOnlyProtocolParameter {
  key: string;
  label: string;
  value: string;
  description: string;
  contractSource: string;
}

export interface AdminDashboardOverview {
  isAuthorized: boolean;
  adminAddress: string;
  network: string;
  chainId: number;
  healthMetrics: SystemHealthMetric[];
  operationalQueue: OperationalQueueItem[];
  auditRecords: AdminAuditRecord[];
  readOnlyParameters: ReadOnlyProtocolParameter[];
  governanceNotices: {
    id: string;
    type: 'timelock' | 'sybil' | 'escrow' | 'multisig';
    title: string;
    description: string;
    level: 'info' | 'warning' | 'critical';
  }[];
  fetchedAt: string;
}

export interface ExecuteOperationRequest {
  operationId: string;
  confirmationText: string;
  operatorAddress: string;
}

export interface ExecuteOperationResponse {
  success: boolean;
  operationId: string;
  auditRecord: AdminAuditRecord;
  message: string;
}
