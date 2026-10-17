import type { OperationalQueueItem } from '@/app/types/admin';
import type { ProtocolLifecycleState } from '@/lib/protocol-contract';
import type { VerificationArtifact } from '@/config/protocol/verification-artifact';
import type { ProtocolDiagnostics } from '@/lib/contracts/types';

/**
 * UI-FE-031 — Upgrade and Governed-Unpause Review State Model.
 *
 * Pure, fail-closed model for the upgrade/unpause review surface.
 * Every state is derived from canonical release artifacts, maintainer-declared
 * candidate evidence, and operational queue snapshots. Nothing is executed,
 * invented, or used to authorize a protocol mutation.
 *
 * Security invariants:
 *   - The current release is verified by the build-time artifact pipeline
 *     (scripts/verify-artifacts.mjs). Client state never invents that
 *     verification; it only surfaces the declared evidence.
 *   - A candidate release is maintainer-controlled evidence. It is never
 *     executed from this interface, and every candidate claim requires explicit
 *     maintainer confirmation before any execution could be considered.
 *   - Authorization/version registry records are evidence, never execution.
 *   - Client state never invents transaction lifecycle or governed calls.
 */

/** Verification state of the candidate release review. */
export type UpgradeReviewVerificationState = 'verified' | 'unverified';

/** Current (active) protocol release, as registered and verified at build time. */
export interface CurrentReleaseReview {
  protocolVersion: string;
  releaseId: string;
  gitCommit: string;
  chainId: number;
  abiVersion: string;
  eventSchemaVersion: string;
  parameterSetVersion: string;
  /** Declared SHA-256 of the tracked ABI artifact (provenance). */
  abiHash: string | null;
  /** True only because the build pipeline verified the release artifacts. */
  currentReleaseVerified: boolean;
  /** Compatibility/layout issues detected against the current release. */
  compatibilityIssues: string[];
  blockedReasons: string[];
}

/**
 * Maintainer-declared compatibility evidence for a candidate release.
 * All fields are provided by the maintainer and are never user-configurable.
 */
export interface UpgradeCandidateCompatibility {
  abiVersion: string;
  eventSchemaVersion: string;
  parameterSetVersion: string;
  /** Human-readable statements about how the candidate stays compatible. */
  chainCompatibility: string[];
}

/**
 * Maintainer-controlled candidate descriptor. This is review evidence only:
 * the interface never executes, schedules, or confirms any candidate action.
 */
export interface UpgradeCandidateDescriptor {
  candidateId: string;
  releaseId: string;
  protocolVersion: string;
  summary: string;
  compatibility: UpgradeCandidateCompatibility;
  /** Identifiers of operational queue items affected by the candidate. */
  affectedOperations: string[];
  rollbackPlan: {
    steps: string[];
    /** True only when a maintainer confirmed the rollback plan. */
    verified: boolean;
  };
  /** Explicitly maintainer-confirmed verification. Unverified by default. */
  verification: UpgradeReviewVerificationState;
  verifiedBy: string | null;
  verifiedAt: string | null;
}

/**
 * Exact governed call the timelock executor would perform.
 * Mirrors the canonical receipts governance action vocabulary
 * (UI-FE-080). Displayed for visibility only — never invoked here.
 */
export interface UpgradeGovernedCall {
  actionType: 'governance';
  /** Exact target the executor invokes, e.g. TimelockController#executeProposal. */
  targetResource: string;
  summary: string;
}

/** Operational queue item affected by the candidate, resolved against live queue data. */
export interface AffectedOperationReview {
  operationId: string;
  queued: boolean;
  queueAge: string | null;
  reason: string;
}

export interface RollbackReview {
  steps: string[];
  verified: boolean;
  blockedReasons: string[];
}

export interface UpgradeReviewSnapshot {
  currentRelease: CurrentReleaseReview;
  candidate: UpgradeCandidateDescriptor;
  currentLifecycle: {
    state: ProtocolLifecycleState;
    label: string;
    blockingReasons: string[];
  };
  governedCalls: UpgradeGovernedCall[];
  affectedOperations: AffectedOperationReview[];
  rollback: RollbackReview;
  /** Any reason the candidate execution must stay blocked. */
  blockedReasons: string[];
  /** True when every verification gate required by the review passes. */
  isFullyVerified: boolean;
  /** True when the current protocol contract would refuse a new upgrade. */
  currentLifecycleBlocksMutation: boolean;
}

/** Inputs accepted by {@link resolveUpgradeReview}. */
export interface ResolveUpgradeReviewInput {
  /**
   * Operational queue snapshot used to cross-reference affected operations.
   * Omitted means "no operational queue available" — cross-referencing is
   * skipped and every declared affected operation is reported as scoped only.
   */
  operationalQueue?: OperationalQueueItem[];
  /** Optional maintainer-declared candidate. Defaults to the canonical candidate. */
  candidate?: UpgradeCandidateDescriptor;
  /** Optional verification artifact override; defaults to the live registry. */
  artifact?: VerificationArtifact;
  /** Optional diagnostics override; defaults to the live registry. */
  diagnostics?: ProtocolDiagnostics;
}
