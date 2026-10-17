/**
 * UI-FE-077 — pure RPC quorum, failover, and presentation evaluation.
 *
 * Semantics:
 *  - Data is accepted only from reviewed providers that report the expected
 *    chain, release, and artifact checksum.
 *  - A provider with a lagging head or stale observation cannot count toward
 *    quorum.
 *  - Conflicting receipts/projections fail closed (no accepted data, no
 *    mutations).
 *  - A fallback can never silently change chain or release.
 *  - Telemetry contains counts/state only — never endpoints, API keys, or raw
 *    provider payloads.
 */

import {
  DEFAULT_RPC_QUORUM_POLICY,
  RpcHealthConfigurationError,
  type ReviewedRpcConfiguration,
  type ReviewedRpcProvider,
  type RpcDivergence,
  type RpcHealthPresentation,
  type RpcHealthState,
  type RpcHealthTelemetry,
  type RpcObservationFailure,
  type RpcProviderObservation,
  type RpcQuorumPolicy,
  type RpcQuorumRejectionReason,
  type RpcQuorumResult,
  type RpcRecoveryGuidance,
  type RpcRejectedProvider,
} from './types';

const CLOCK_SKEW_MS = 60_000;

export function validateReviewedRpcConfiguration(
  configuration: ReviewedRpcConfiguration,
): void {
  if (
    !Number.isInteger(configuration.expectedChainId) ||
    configuration.expectedChainId <= 0
  ) {
    throw new RpcHealthConfigurationError('expectedChainId must be a positive integer');
  }
  if (
    typeof configuration.expectedReleaseId !== 'string' ||
    configuration.expectedReleaseId.length === 0
  ) {
    throw new RpcHealthConfigurationError('expectedReleaseId must be non-empty');
  }
  if (
    typeof configuration.expectedArtifactChecksum !== 'string' ||
    configuration.expectedArtifactChecksum.length === 0
  ) {
    throw new RpcHealthConfigurationError(
      'expectedArtifactChecksum must be non-empty',
    );
  }
  if (!Array.isArray(configuration.providers) || configuration.providers.length < 2) {
    throw new RpcHealthConfigurationError(
      'at least one primary and one fallback provider are required',
    );
  }

  const ids = new Set<string>();
  let primaryCount = 0;
  let fallbackCount = 0;

  for (const provider of configuration.providers) {
    if (typeof provider.id !== 'string' || provider.id.length === 0) {
      throw new RpcHealthConfigurationError('provider id must be non-empty');
    }
    if (ids.has(provider.id)) {
      throw new RpcHealthConfigurationError(`duplicate provider id: ${provider.id}`);
    }
    ids.add(provider.id);

    if (provider.role !== 'primary' && provider.role !== 'fallback') {
      throw new RpcHealthConfigurationError(
        `provider ${provider.id} has an invalid role`,
      );
    }
    if (provider.role === 'primary') primaryCount += 1;
    else fallbackCount += 1;

    if (provider.chainId !== configuration.expectedChainId) {
      throw new RpcHealthConfigurationError(
        `provider ${provider.id} chainId does not match the reviewed chain`,
      );
    }
    if (
      provider.releaseId !== configuration.expectedReleaseId ||
      provider.artifactChecksum !== configuration.expectedArtifactChecksum
    ) {
      throw new RpcHealthConfigurationError(
        `provider ${provider.id} release does not match the reviewed release`,
      );
    }
  }

  if (primaryCount < 1 || fallbackCount < 1) {
    throw new RpcHealthConfigurationError(
      'reviewed configuration must include a primary and a fallback',
    );
  }

  const policy = configuration.policy;
  if (
    !Number.isInteger(policy.minimumAgreeingProviders) ||
    policy.minimumAgreeingProviders < 1 ||
    policy.minimumAgreeingProviders > configuration.providers.length
  ) {
    throw new RpcHealthConfigurationError(
      'minimumAgreeingProviders must be within the provider count',
    );
  }
  if (!Number.isInteger(policy.maxHeadLagBlocks) || policy.maxHeadLagBlocks < 0) {
    throw new RpcHealthConfigurationError('maxHeadLagBlocks must be non-negative');
  }
  if (!Number.isFinite(policy.maxObservationAgeMs) || policy.maxObservationAgeMs <= 0) {
    throw new RpcHealthConfigurationError('maxObservationAgeMs must be positive');
  }
}

function recoveryFor(
  state: RpcHealthState,
  quorumSatisfied: boolean,
  divergence: RpcDivergence | null,
  isUsingFallback: boolean,
): RpcRecoveryGuidance {
  if (divergence) {
    return {
      title: 'RPC data conflict',
      message:
        'Reviewed RPC providers returned conflicting receipts or projections. No data is accepted and mutations are blocked. Retry after providers converge.',
      action: 'retry',
      actionLabel: 'Retry health check',
      role: 'alert',
      ariaLive: 'assertive',
      tone: 'danger',
    };
  }

  if (state === 'primary') {
    return {
      title: 'RPC health good',
      message:
        'Primary RPC is responding on the expected chain and release. Mutations remain available while quorum is satisfied.',
      action: 'none',
      actionLabel: null,
      role: 'status',
      ariaLive: 'polite',
      tone: 'success',
    };
  }

  if (state === 'fallback') {
    return {
      title: 'Using reviewed RPC fallback',
      message:
        'Primary RPC is unavailable. A reviewed fallback on the same chain and release is serving data; mutations remain available while quorum is satisfied.',
      action: 'retry',
      actionLabel: 'Retry primary RPC',
      role: 'status',
      ariaLive: 'polite',
      tone: 'warning',
    };
  }

  if (state === 'degraded') {
    if (quorumSatisfied) {
      return {
        title: 'RPC quorum degraded',
        message:
          'Some reviewed RPC providers are degraded, but quorum is satisfied. Mutations remain available; retry for full health.',
        action: 'retry',
        actionLabel: 'Retry health check',
        role: 'status',
        ariaLive: 'polite',
        tone: 'warning',
      };
    }
    return {
      title: 'RPC quorum incomplete',
      message:
        'Reviewed RPC providers do not satisfy quorum. Reads may be limited and mutations are blocked. Retry when providers recover.',
      action: 'retry',
      actionLabel: 'Retry health check',
      role: 'alert',
      ariaLive: 'assertive',
      tone: 'warning',
    };
  }

  if (state === 'stale') {
    return {
      title: 'RPC data is stale',
      message:
        'RPC observations are stale or lagging. Refresh before relying on data; mutations are blocked.',
      action: 'retry',
      actionLabel: 'Refresh RPC health',
      role: 'alert',
      ariaLive: 'assertive',
      tone: 'warning',
    };
  }

  return {
    title: 'RPC quorum unavailable',
    message:
      'No reviewed RPC provider can satisfy quorum. Mutations are blocked. Retry when providers recover.',
    action: 'retry',
    actionLabel: 'Retry health check',
    role: 'alert',
    ariaLive: 'assertive',
    tone: 'danger',
  };
}

function reject(
  providerId: string,
  role: ReviewedRpcProvider['role'] | null,
  reason: RpcQuorumRejectionReason,
): RpcRejectedProvider {
  return { providerId, role, reason };
}

function failureToRejection(
  providerId: string,
  role: ReviewedRpcProvider['role'] | null,
  failure: RpcObservationFailure,
): RpcRejectedProvider {
  // The public presentation does not distinguish provider failure types; they
  // all fail closed for quorum.
  void failure;
  return reject(providerId, role, 'provider-failure');
}

function fingerprint(value: string, status: string): string {
  return `${value}:${status}`;
}

function detectReceiptDivergence(
  observations: readonly RpcProviderObservation[],
): RpcDivergence | null {
  const byTx = new Map<string, Map<string, Set<string>>>();
  for (const observation of observations) {
    for (const receipt of observation.receipts ?? []) {
      if (
        typeof receipt.txHash !== 'string' ||
        receipt.txHash.length === 0 ||
        typeof receipt.blockHash !== 'string' ||
        receipt.blockHash.length === 0 ||
        (receipt.status !== 'success' && receipt.status !== 'reverted')
      ) {
        continue;
      }
      const fingerprints = byTx.get(receipt.txHash) ?? new Map<string, Set<string>>();
      const printed = fingerprint(receipt.blockHash, receipt.status);
      const providers = fingerprints.get(printed) ?? new Set<string>();
      providers.add(observation.providerId);
      fingerprints.set(printed, providers);
      byTx.set(receipt.txHash, fingerprints);
    }
  }

  const keys: string[] = [];
  const providers = new Set<string>();
  for (const [txHash, fingerprints] of byTx) {
    if (fingerprints.size > 1) {
      keys.push(txHash);
      for (const ids of fingerprints.values()) {
        for (const id of ids) providers.add(id);
      }
    }
  }

  if (keys.length === 0) return null;
  return {
    reason: 'receipt',
    keys: keys.sort(),
    providerIds: Array.from(providers).sort(),
  };
}

function detectProjectionDivergence(
  observations: readonly RpcProviderObservation[],
): RpcDivergence | null {
  const byKey = new Map<string, Map<string, Set<string>>>();
  for (const observation of observations) {
    for (const projection of observation.projections ?? []) {
      if (
        typeof projection.key !== 'string' ||
        projection.key.length === 0 ||
        typeof projection.fingerprint !== 'string' ||
        projection.fingerprint.length === 0
      ) {
        continue;
      }
      const fingerprints =
        byKey.get(projection.key) ?? new Map<string, Set<string>>();
      const providers = fingerprints.get(projection.fingerprint) ?? new Set<string>();
      providers.add(observation.providerId);
      fingerprints.set(projection.fingerprint, providers);
      byKey.set(projection.key, fingerprints);
    }
  }

  const keys: string[] = [];
  const providers = new Set<string>();
  for (const [key, fingerprints] of byKey) {
    if (fingerprints.size > 1) {
      keys.push(key);
      for (const ids of fingerprints.values()) {
        for (const id of ids) providers.add(id);
      }
    }
  }

  if (keys.length === 0) return null;
  return {
    reason: 'projection',
    keys: keys.sort(),
    providerIds: Array.from(providers).sort(),
  };
}

function resultWithoutQuorum(
  state: RpcHealthState,
  rejectedProviders: readonly RpcRejectedProvider[],
  observedAtMs: number,
  divergence: RpcDivergence | null = null,
  agreeingProviderIds: readonly string[] = [],
): RpcQuorumResult {
  const recovery = recoveryFor(state, false, divergence, false);
  return {
    state,
    quorumSatisfied: false,
    mutationAllowed: false,
    isUsingFallback: false,
    acceptedChainId: null,
    acceptedReleaseId: null,
    acceptedArtifactChecksum: null,
    acceptedHeadBlock: null,
    agreeingProviderIds,
    rejectedProviders,
    divergence,
    recovery,
    observedAtMs,
  };
}

/**
 * Evaluate reviewed RPC observations against the quorum/confidence policy.
 * Throws `RpcHealthConfigurationError` for malformed reviewed configuration;
 * malformed observations are rejected and fail closed.
 */
export function evaluateRpcQuorum(
  configuration: ReviewedRpcConfiguration,
  observations: readonly RpcProviderObservation[],
  nowMs: number = Date.now(),
): RpcQuorumResult {
  validateReviewedRpcConfiguration(configuration);

  const reviewedById = new Map(
    configuration.providers.map((provider) => [provider.id, provider]),
  );
  const rejected: RpcRejectedProvider[] = [];
  const fresh: Array<{
    provider: ReviewedRpcProvider;
    observation: RpcProviderObservation;
    headBlock: number;
  }> = [];

  for (const observation of observations) {
    const provider = reviewedById.get(observation.providerId);
    if (!provider) {
      rejected.push(reject(observation.providerId, null, 'unknown-provider'));
      continue;
    }

    if (observation.failure) {
      rejected.push(
        failureToRejection(provider.id, provider.role, observation.failure),
      );
      continue;
    }

    if (observation.chainId !== configuration.expectedChainId) {
      rejected.push(reject(provider.id, provider.role, 'wrong-chain'));
      continue;
    }

    if (
      configuration.policy.requireReleaseMatch &&
      (observation.releaseId !== configuration.expectedReleaseId ||
        observation.artifactChecksum !== configuration.expectedArtifactChecksum)
    ) {
      rejected.push(reject(provider.id, provider.role, 'wrong-release'));
      continue;
    }

    if (
      !Number.isFinite(observation.observedAtMs) ||
      observation.observedAtMs <= 0 ||
      observation.observedAtMs > nowMs + CLOCK_SKEW_MS
    ) {
      rejected.push(reject(provider.id, provider.role, 'malformed-observation'));
      continue;
    }

    if (nowMs - observation.observedAtMs > configuration.policy.maxObservationAgeMs) {
      rejected.push(reject(provider.id, provider.role, 'stale-observation'));
      continue;
    }

    if (
      typeof observation.headBlock !== 'number' ||
      !Number.isSafeInteger(observation.headBlock) ||
      observation.headBlock < 0
    ) {
      rejected.push(reject(provider.id, provider.role, 'malformed-observation'));
      continue;
    }

    fresh.push({
      provider,
      observation,
      headBlock: observation.headBlock,
    });
  }

  const freshObservations = fresh.map((entry) => entry.observation);
  const divergence =
    detectReceiptDivergence(freshObservations) ??
    detectProjectionDivergence(freshObservations);
  if (divergence) {
    return resultWithoutQuorum('unavailable', rejected, nowMs, divergence);
  }

  if (fresh.length === 0) {
    const stale = rejected.some(
      (entry) => entry.reason === 'stale-observation',
    );
    return resultWithoutQuorum(stale ? 'stale' : 'unavailable', rejected, nowMs);
  }

  const bestHead = Math.max(...fresh.map((entry) => entry.headBlock));
  const agreeing = fresh.filter((entry) => {
    if (bestHead - entry.headBlock > configuration.policy.maxHeadLagBlocks) {
      rejected.push(
        reject(entry.provider.id, entry.provider.role, 'lagging-head'),
      );
      return false;
    }
    return true;
  });

  if (agreeing.length < configuration.policy.minimumAgreeingProviders) {
    const state: RpcHealthState =
      agreeing.length === 0 ? 'stale' : 'degraded';
    return resultWithoutQuorum(
      state,
      rejected,
      nowMs,
      null,
      agreeing.map((entry) => entry.provider.id),
    );
  }

  const primaryAgreeing = agreeing.some(
    (entry) => entry.provider.role === 'primary',
  );
  const isUsingFallback = !primaryAgreeing;
  const state: RpcHealthState = isUsingFallback
    ? 'fallback'
    : rejected.length > 0
      ? 'degraded'
      : 'primary';
  const recovery = recoveryFor(state, true, null, isUsingFallback);

  return {
    state,
    quorumSatisfied: true,
    mutationAllowed: true,
    isUsingFallback,
    acceptedChainId: configuration.expectedChainId,
    acceptedReleaseId: configuration.expectedReleaseId,
    acceptedArtifactChecksum: configuration.expectedArtifactChecksum,
    acceptedHeadBlock: bestHead,
    agreeingProviderIds: agreeing.map((entry) => entry.provider.id),
    rejectedProviders: rejected,
    divergence: null,
    recovery,
    observedAtMs: nowMs,
  };
}

const STATE_LABELS: Record<RpcHealthState, string> = {
  primary: 'RPC primary healthy',
  fallback: 'RPC fallback active',
  degraded: 'RPC degraded',
  stale: 'RPC data stale',
  unavailable: 'RPC unavailable',
};

export function buildRpcHealthPresentation(
  result: RpcQuorumResult,
  totalProviderCount: number,
): RpcHealthPresentation {
  const agreeing = result.agreeingProviderIds.length;
  const total = Math.max(totalProviderCount, agreeing);
  return {
    state: result.state,
    label: STATE_LABELS[result.state],
    tone: result.recovery.tone,
    role: result.recovery.role,
    ariaLive: result.recovery.ariaLive,
    message: result.recovery.message,
    recoveryAction: result.recovery.action,
    recoveryLabel: result.recovery.actionLabel,
    quorumSummary: `${agreeing} of ${total} reviewed providers agree`,
    mutationSummary: result.mutationAllowed
      ? 'Mutations available'
      : 'Mutations blocked',
  };
}

/**
 * Privacy-safe telemetry: state and counts only. Provider ids, endpoints, API
 * keys, and raw observations never leave the boundary.
 */
export function buildRpcHealthTelemetry(
  result: RpcQuorumResult,
  totalProviderCount: number,
): RpcHealthTelemetry {
  const rejectedReasonCounts: Record<string, number> = {};
  for (const entry of result.rejectedProviders) {
    rejectedReasonCounts[entry.reason] =
      (rejectedReasonCounts[entry.reason] ?? 0) + 1;
  }

  return {
    event: 'rpc_health',
    state: result.state,
    quorumSatisfied: result.quorumSatisfied,
    mutationAllowed: result.mutationAllowed,
    fallbackUsed: result.isUsingFallback,
    acceptedChainId: result.acceptedChainId,
    acceptedReleaseId: result.acceptedReleaseId,
    agreeingProviderCount: result.agreeingProviderIds.length,
    totalProviderCount,
    rejectedReasonCounts,
    divergenceReason: result.divergence?.reason ?? null,
  };
}

export function defaultRpcQuorumPolicy(
  overrides: Partial<RpcQuorumPolicy> = {},
): RpcQuorumPolicy {
  return { ...DEFAULT_RPC_QUORUM_POLICY, ...overrides };
}
