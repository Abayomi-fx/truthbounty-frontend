/**
 * UI-FE-077 — reviewed RPC health, quorum, and failover presentation types.
 *
 * Provider endpoints and credentials are deliberately absent from this
 * boundary. Callers supply reviewed configuration (labels + expected
 * chain/release) and sanitized observations; no raw endpoint is ever surfaced
 * in the presentation or telemetry payloads.
 */

export type RpcProviderRole = 'primary' | 'fallback';

export interface ReviewedRpcProvider {
  /** Stable, non-sensitive label (e.g. `primary`, `fallback-1`). */
  readonly id: string;
  readonly role: RpcProviderRole;
  /** Reviewed chain the provider is allowed to serve. */
  readonly chainId: number;
  /** Reviewed release id the provider must report. */
  readonly releaseId: string;
  /** Reviewed release artifact checksum the provider must report. */
  readonly artifactChecksum: string;
}

export interface RpcQuorumPolicy {
  /** Minimum fresh, agreeing providers required to accept data. */
  readonly minimumAgreeingProviders: number;
  /** Maximum head lag (blocks) between the best head and another provider. */
  readonly maxHeadLagBlocks: number;
  /** Observations older than this are stale and must not count toward quorum. */
  readonly maxObservationAgeMs: number;
  /** Require the fallback's release id/checksum to match the primary release. */
  readonly requireReleaseMatch: boolean;
}

export const DEFAULT_RPC_QUORUM_POLICY: RpcQuorumPolicy = Object.freeze({
  minimumAgreeingProviders: 2,
  maxHeadLagBlocks: 5,
  maxObservationAgeMs: 30_000,
  requireReleaseMatch: true,
});

export interface ReviewedRpcConfiguration {
  readonly expectedChainId: number;
  readonly expectedReleaseId: string;
  readonly expectedArtifactChecksum: string;
  readonly providers: readonly ReviewedRpcProvider[];
  readonly policy: RpcQuorumPolicy;
}

export type RpcObservationFailure =
  | 'timeout'
  | 'rate-limited'
  | 'network-error'
  | 'server-error'
  | 'unavailable';

export interface RpcReceiptObservation {
  readonly txHash: string;
  readonly blockHash: string;
  readonly status: 'success' | 'reverted';
}

export interface RpcProjectionFingerprint {
  /** Stable projection key (e.g. `claim:claim-1`). */
  readonly key: string;
  /** Fingerprint of the projected value. Never a raw payload. */
  readonly fingerprint: string;
}

export interface RpcProviderObservation {
  readonly providerId: string;
  /** Unix ms when the observation was captured. */
  readonly observedAtMs: number;
  readonly chainId?: number | null;
  readonly releaseId?: string | null;
  readonly artifactChecksum?: string | null;
  readonly headBlock?: number | null;
  readonly latencyMs?: number | null;
  readonly failure?: RpcObservationFailure | null;
  readonly receipts?: readonly RpcReceiptObservation[];
  readonly projections?: readonly RpcProjectionFingerprint[];
}

export type RpcQuorumRejectionReason =
  | 'unknown-provider'
  | 'provider-failure'
  | 'wrong-chain'
  | 'wrong-release'
  | 'malformed-observation'
  | 'stale-observation'
  | 'lagging-head';

export interface RpcRejectedProvider {
  readonly providerId: string;
  readonly role: RpcProviderRole | null;
  readonly reason: RpcQuorumRejectionReason;
}

export type RpcDivergenceReason = 'receipt' | 'projection';

export interface RpcDivergence {
  readonly reason: RpcDivergenceReason;
  /** Entity keys that diverged (tx hashes / projection keys). */
  readonly keys: readonly string[];
  /** Provider labels that participated in the divergence. */
  readonly providerIds: readonly string[];
}

export type RpcHealthState =
  | 'primary'
  | 'fallback'
  | 'degraded'
  | 'stale'
  | 'unavailable';

export type RpcRecoveryAction = 'none' | 'retry' | 'reconnect' | 'wait';

export interface RpcRecoveryGuidance {
  readonly title: string;
  readonly message: string;
  readonly action: RpcRecoveryAction;
  readonly actionLabel: string | null;
  /** WCAG live-region semantics for the presentation. */
  readonly role: 'status' | 'alert';
  readonly ariaLive: 'polite' | 'assertive';
  readonly tone: 'success' | 'warning' | 'danger' | 'neutral';
}

export interface RpcQuorumResult {
  readonly state: RpcHealthState;
  readonly quorumSatisfied: boolean;
  readonly mutationAllowed: boolean;
  readonly isUsingFallback: boolean;
  readonly acceptedChainId: number | null;
  readonly acceptedReleaseId: string | null;
  readonly acceptedArtifactChecksum: string | null;
  readonly acceptedHeadBlock: number | null;
  readonly agreeingProviderIds: readonly string[];
  readonly rejectedProviders: readonly RpcRejectedProvider[];
  readonly divergence: RpcDivergence | null;
  readonly recovery: RpcRecoveryGuidance;
  readonly observedAtMs: number;
}

export interface RpcHealthPresentation {
  readonly state: RpcHealthState;
  readonly label: string;
  readonly tone: RpcRecoveryGuidance['tone'];
  readonly role: RpcRecoveryGuidance['role'];
  readonly ariaLive: RpcRecoveryGuidance['ariaLive'];
  readonly message: string;
  readonly recoveryAction: RpcRecoveryAction;
  readonly recoveryLabel: string | null;
  readonly quorumSummary: string;
  readonly mutationSummary: string;
}

export interface RpcHealthTelemetry {
  readonly event: 'rpc_health';
  readonly state: RpcHealthState;
  readonly quorumSatisfied: boolean;
  readonly mutationAllowed: boolean;
  readonly fallbackUsed: boolean;
  readonly acceptedChainId: number | null;
  readonly acceptedReleaseId: string | null;
  readonly agreeingProviderCount: number;
  readonly totalProviderCount: number;
  readonly rejectedReasonCounts: Readonly<Record<string, number>>;
  readonly divergenceReason: RpcDivergenceReason | null;
}

export class RpcHealthConfigurationError extends Error {
  constructor(message: string) {
    super(`[RpcHealth] ${message}`);
    this.name = 'RpcHealthConfigurationError';
  }
}
