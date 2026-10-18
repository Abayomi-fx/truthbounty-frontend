/**
 * Admin Operations & Governance Types — V2-FE-154
 *
 * Types for authorized admin system health, bounded operational queues,
 * audit references, and read-only protocol configuration.
 */

export type OperationRiskLevel = 'low' | 'medium' | 'high';
export type OperationAuthority = 'PROTOCOL_OPERATOR' | 'EMERGENCY_ADMIN' | 'AUDIT_ADMIN';
export type OperationalItemStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type OperationalQueueLifecycle = 'pending' | 'delayed' | 'failed' | 'quarantined' | 'recovered';

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
  /** Optional backend lifecycle projection. Missing values remain unknown in the UI. */
  queueState?: OperationalQueueLifecycle;
  /** Retry facts are only authoritative when supplied by the protected queue adapter. */
  retryEligibility?: {
    eligible: boolean;
    permissionMapped: boolean;
    idempotencyProofRef?: string;
    reason?: string;
  };
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

/**
 * Operational Health & Release Status — UI-FE-025
 *
 * Truthful, freshness-labelled composition of API/RPC/indexer/database/release
 * health. Observations never grant authority; API data is projection data only.
 * Stale or missing observations must never render as healthy.
 */

/**
 * Observation lifecycle states. `unavailable` and `stale` MUST NOT be treated
 * as healthy by any consumer. `delayed` and `degraded` are non-healthy too.
 */
export type HealthObservationState =
  | 'healthy'
  | 'degraded'
  | 'delayed'
  | 'stale'
  | 'unavailable';

/**
 * Subsystem scope for a health observation. Each subsystem is composed
 * independently so a single failure cannot be masked by an aggregate.
 */
export type HealthSubsystem =
  | 'api'
  | 'rpc'
  | 'indexer'
  | 'database'
  | 'release';

/**
 * Freshness context for an observation. `ageSeconds` is derived from the
 * observation timestamp relative to the composition time; `thresholdSeconds`
 * is the maximum age considered fresh for the subsystem.
 */
export interface HealthFreshness {
  observedAt: string; // ISO 8601
  ageSeconds: number;
  thresholdSeconds: number;
  isFresh: boolean;
}

/**
 * Finalized-block context. `null` when the subsystem cannot report a
 * finalized head (e.g. unavailable). `lagBlocks` is finalized head minus
 * observed head; `null` when unknown.
 */
export interface FinalizedBlockContext {
  chainId: number;
  finalizedBlockNumber: number | null;
  observedBlockNumber: number | null;
  lagBlocks: number | null;
  finalizedAt: string | null; // ISO 8601
}

/**
 * ABI/manifest verification result for a subsystem. `unverified` and
 * `mismatch` MUST NOT be rendered as healthy.
 */
export type AbiManifestVerificationState =
  | 'verified'
  | 'unverified'
  | 'mismatch'
  | 'unavailable';

export interface AbiManifestVerification {
  state: AbiManifestVerificationState;
  manifestRef: string | null;
  abiHash: string | null;
  expectedHash: string | null;
  verifiedAt: string | null; // ISO 8601
  notes?: string;
}

/**
 * Affected scope describes what is impacted by a non-healthy observation.
 * `isTruthBountyGuarantee` is false for third-party dependency status so the
 * UI never presents external status as a TruthBounty guarantee.
 */
export interface HealthAffectedScope {
  subsystems: HealthSubsystem[];
  userFacingImpact: string;
  isTruthBountyGuarantee: boolean;
  dependencyName?: string;
}

/**
 * A single composed health observation for one subsystem. `state` is the
 * authoritative observation; `rawStatus` preserves the upstream label for
 * auditability. `isAuthoritative` is always false — observations never grant
 * authority and never change protocol truth.
 */
export interface HealthObservation {
  id: string;
  subsystem: HealthSubsystem;
  state: HealthObservationState;
  rawStatus?: string;
  summary: string;
  source: string;
  freshness: HealthFreshness;
  finalizedBlock: FinalizedBlockContext | null;
  abiManifest: AbiManifestVerification;
  affectedScope: HealthAffectedScope;
  isAuthoritative: false;
  fetchedAt: string; // ISO 8601
}

/**
 * Composed operational health snapshot. `overallState` is the worst-case
 * rollup of `observations`; it MUST NOT be `healthy` if any observation is
 * `degraded`, `delayed`, `stale`, or `unavailable`.
 */
export interface OperationalHealthSnapshot {
  overallState: HealthObservationState;
  observations: HealthObservation[];
  composedAt: string; // ISO 8601
  isAuthoritative: false;
}

/**
 * Release status projection. `isTruthBountyGuarantee` is false when the
 * status derives from a third-party dependency.
 */
export interface ReleaseStatus {
  version: string;
  commitRef: string | null;
  deployedAt: string | null; // ISO 8601
  state: HealthObservationState;
  abiManifest: AbiManifestVerification;
  affectedScope: HealthAffectedScope;
  isTruthBountyGuarantee: boolean;
  fetchedAt: string; // ISO 8601
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
  operationalHealth: OperationalHealthSnapshot;
  releaseStatus: ReleaseStatus;
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
