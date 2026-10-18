/**
 * UI-FE-031 — Upgrade and Governed-Unpause Review Resolver.
 *
 * Fail-closed resolver for the upgrade/unpause review surface.
 *
 * Responsibilities:
 *   - Surface the current release and the maintainer-declared candidate.
 *   - Surface compatibility/layout evidence for both releases.
 *   - Cross-reference the candidate's affected operations with the
 *     operational queue snapshot.
 *   - Surface the exact governed calls awaiting timelock execution.
 *   - Resolve the current protocol lifecycle without inventing state.
 *   - Produce blocking reasons — any missing verification blocks action.
 *
 * Execution is never performed here. Authorization/version registry records
 * are evidence only, exactly as required by the governing issue.
 */

import {
  getProtocolDiagnostics,
  getProtocolRelease,
} from '@/lib/contracts/registry';
import {
  validateAbiSurface,
  validateEventSchema,
  type EventSchemaLike,
} from '@/lib/contracts/contract-evolution';
import { PROTOCOL_LIFECYCLE_LABELS, resolveProtocolContractUi, type ProtocolLifecycleState } from '@/lib/protocol-contract';
import type {
  UpgradeCandidateDescriptor,
  UpgradeGovernedCall,
} from './types';
import { UPGRADE_CANDIDATE, UPGRADE_GOVERNED_CALLS } from './candidate';
import type {
  CurrentReleaseReview,
  ResolveUpgradeReviewInput,
  UpgradeReviewSnapshot,
} from './types';
import type {
  AffectedOperationReview,
  RollbackReview,
} from './types';

function currentReleaseReview(): CurrentReleaseReview {
  const release = getProtocolRelease();
  const diagnostics = getProtocolDiagnostics();
  const manifest = release.manifest;

  const compatibilityIssues = validateCurrentCompatibility();
  const currentReleaseVerified = Boolean(
    diagnostics.abiHash && diagnostics.gitCommit.trim() !== '',
  );
  const blockedReasons: string[] = [];
  if (!currentReleaseVerified) {
    blockedReasons.push(
      'current release verification evidence is missing from the release registry',
    );
  }

  return {
    protocolVersion: manifest.protocolVersion,
    releaseId: manifest.releaseId,
    gitCommit: manifest.gitCommit,
    chainId: manifest.chainId,
    abiVersion: manifest.abiVersion,
    eventSchemaVersion: manifest.eventSchemaVersion,
    parameterSetVersion: manifest.parameterSetVersion,
    abiHash: diagnostics.abiHash,
    currentReleaseVerified,
    compatibilityIssues,
    blockedReasons,
  };
}

function validateCurrentCompatibility(): string[] {
  const release = getProtocolRelease();
  const issues: string[] = [];

  const abiIssues = validateAbiSurface(
    release.abis.TruthBountyWeighted as readonly unknown[],
  );
  for (const issue of abiIssues) {
    issues.push(`current ABI: ${issue.message}`);
  }

  const events = release.events as unknown as EventSchemaLike;
  const eventIssues = validateEventSchema(events);
  for (const issue of eventIssues) {
    issues.push(`current event schema: ${issue.message}`);
  }

  return issues;
}

/**
 * Blocking reasons for the candidate verification gates. Exported so the
 * verification evidence surface can render exactly these reasons.
 */
export function resolveCandidateVerification(
  candidate: UpgradeCandidateDescriptor,
): string[] {
  const blocked: string[] = [];

  if (candidate.verification !== 'verified') {
    blocked.push('candidate manifest is not verified by a maintainer');
  }
  if (candidate.compatibility.chainCompatibility.length === 0) {
    blocked.push('candidate layout compatibility is not declared');
  }
  if (candidate.rollbackPlan.steps.length === 0) {
    blocked.push('candidate rollback plan is empty');
  }
  if (!candidate.rollbackPlan.verified) {
    blocked.push('candidate rollback plan is not verified');
  }

  return blocked;
}

function affectedOperationsReview(
  candidate: UpgradeCandidateDescriptor,
  operationalQueue: ResolveUpgradeReviewInput['operationalQueue'],
): AffectedOperationReview[] {
  return candidate.affectedOperations.map((operationId) => {
    const item = operationalQueue?.find((entry) => entry.id === operationId);
    if (!item) {
      return {
        operationId,
        queued: false,
        queueAge: null,
        reason: 'declared for review only; not present in the operational queue',
      };
    }
    return {
      operationId,
      queued: true,
      queueAge: item.queueAge,
      reason: `queued operation; queue age ${item.queueAge}`,
    };
  });
}

function governedCallsReview(): UpgradeGovernedCall[] {
  return UPGRADE_GOVERNED_CALLS.map((call) => ({ ...call }));
}

function rollbackReview(candidate: UpgradeCandidateDescriptor): RollbackReview {
  const verified = candidate.rollbackPlan.verified;

  return {
    steps: candidate.rollbackPlan.steps,
    verified,
    blockedReasons: verified
      ? []
      : ['candidate rollback plan is not verified'],
  };
}

/** Lifecycle states that would make a new upgrade execution fail. */
const BLOCKING_LIFECYCLE_STATES = new Set<string>([
  'loading',
  'stale',
  'rejected',
  'failed',
  'reorged',
]);

function lifecycleBlocksMutation(state: ProtocolLifecycleState): boolean {
  return BLOCKING_LIFECYCLE_STATES.has(state);
}

/**
 * Resolve the upgrade/unpause review state. Fails closed: any missing
 * verification, missing compatibility evidence, or blocking current
 * lifecycle produces a blocking reason and `isFullyVerified: false`.
 */
export function resolveUpgradeReview(
  input: ResolveUpgradeReviewInput = {},
): UpgradeReviewSnapshot {
  const currentRelease = currentReleaseReview();
  const currentCompatibilityBlockedReasons = validateCurrentCompatibility();

  const candidate = input.candidate ?? UPGRADE_CANDIDATE;
  const candidateBlockedReasons = resolveCandidateVerification(candidate);

  const currentLifecycleState = resolveProtocolContractUi({
    chainId: currentRelease.chainId,
    artifact: input.artifact,
    diagnostics: input.diagnostics,
    lifecycle: 'empty',
  }).lifecycle;

  const lifecycleBlockingReasons: string[] = [];
  if (lifecycleBlocksMutation(currentLifecycleState)) {
    lifecycleBlockingReasons.push(
      `current protocol lifecycle "${currentLifecycleState}" blocks an upgrade execution`,
    );
  }

  const affectedOperations = affectedOperationsReview(
    candidate,
    input.operationalQueue,
  );
  const governedCalls = governedCallsReview();
  const rollback = rollbackReview(candidate);

  const blockedReasons = [
    ...currentRelease.blockedReasons,
    ...currentCompatibilityBlockedReasons,
    ...candidateBlockedReasons,
    ...rollback.blockedReasons,
    ...lifecycleBlockingReasons,
  ];

  return {
    currentRelease,
    candidate,
    currentLifecycle: {
      state: currentLifecycleState,
      label: PROTOCOL_LIFECYCLE_LABELS[currentLifecycleState],
      blockingReasons: lifecycleBlockingReasons,
    },
    governedCalls,
    affectedOperations,
    rollback,
    blockedReasons,
    isFullyVerified: blockedReasons.length === 0,
    currentLifecycleBlocksMutation:
      lifecycleBlockingReasons.length > 0,
  };
}
