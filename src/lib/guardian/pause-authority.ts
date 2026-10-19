/**
 * UI-FE-032 — Emergency Guardian Pause Control authority model.
 *
 * This module is the single, pure, fail-closed source of truth for whether the
 * UI may initiate an operation-scoped guardian pause on Optimism/EVM.
 *
 * Security invariants (non-negotiable):
 *   1. Authority is NEVER inferred from wallet connection, UI context, route,
 *      or a raw API projection. It is derived only from the pinned release
 *      manifest + ABI and canonical on-chain reads supplied by the caller.
 *   2. A pause scope is actionable ONLY when the pinned ABI declares its
 *      pause entrypoint. Absent ABI proof ⇒ disabled.
 *   3. Unpause, upgrade, treasury, settlement and role-transfer triggers are
 *      never modelled here and can never become actionable.
 *   4. A guardian pause *request* is not an on-chain pause. Only a canonical
 *      read that confirms a module is paused may render "paused".
 *   5. Any missing/unknown/stale/revoked/wrong-network input disables all
 *      actions — fail closed.
 *
 * No mock data, no fabricated hashes, no guessed selectors live here.
 */

import { keccak256, toHex } from 'viem';

import { getAddressValidationError } from '@/lib/contracts/address-guard';
import {
  getContractAbi,
  getReleaseChainId,
} from '@/lib/contracts/registry';
import { OPTIMISM_CHAIN_IDS } from '@/lib/transaction-machine/transaction-machine.types';

/** Chains on which the guardian pause control is permitted to operate. */
export const GUARDIAN_SUPPORTED_CHAIN_IDS = OPTIMISM_CHAIN_IDS;
export type GuardianChainId = (typeof GUARDIAN_SUPPORTED_CHAIN_IDS)[number];

/**
 * Operation scopes a guardian pause may legitimately target.
 * Deliberately excludes settlement and any treasury/role/upgrade scope.
 */
export const APPROVED_PAUSE_SCOPES = [
  'claim-submission',
  'verification',
  'dispute',
  'appeal',
  'reward-distribution',
] as const;
export type GuardianPauseScope = (typeof APPROVED_PAUSE_SCOPES)[number];

/** Human-readable labels for the approved operation scopes. */
export const GUARDIAN_SCOPE_LABELS: Record<GuardianPauseScope, string> = {
  'claim-submission': 'Claim submission',
  verification: 'Verification',
  dispute: 'Dispute opening',
  appeal: 'Appeal',
  'reward-distribution': 'Reward distribution',
};

/**
 * Entrypoints that, when declared by the pinned ABI, prove a scope is
 * pausable. The ABI — not this list — is the authority: this is only the
 * interface name this frontend was built against.
 */
export const PAUSE_ENTRYPOINTS: Record<GuardianPauseScope, readonly string[]> = {
  'claim-submission': ['pauseClaimSubmission'],
  verification: ['pauseVerification'],
  dispute: ['pauseDispute'],
  appeal: ['pauseAppeal'],
  'reward-distribution': ['pauseRewardDistribution'],
};

/**
 * Capabilities this control must NEVER expose. Kept explicit so tests can
 * assert their absence and guard against future regressions.
 */
export const FORBIDDEN_GUARDIAN_CAPABILITIES = [
  'unpause',
  'upgrade',
  'treasury',
  'settlement',
  'role-transfer',
] as const;
export type ForbiddenGuardianCapability =
  (typeof FORBIDDEN_GUARDIAN_CAPABILITIES)[number];

export function isForbiddenGuardianCapability(
  value: string,
): value is ForbiddenGuardianCapability {
  return (FORBIDDEN_GUARDIAN_CAPABILITIES as readonly string[]).includes(
    value,
  );
}

// ---------------------------------------------------------------------------
// ABI-derived proofs
// ---------------------------------------------------------------------------

interface AbiEntry {
  type?: unknown;
  name?: unknown;
  inputs?: readonly { type?: unknown }[];
  stateMutability?: unknown;
}

export interface GuardianPauseProof {
  scope: GuardianPauseScope;
  functionName: string;
  /** Canonical signature, e.g. `pauseDispute(bytes32)`. */
  signature: string;
  /** ABI-declared input types, e.g. `['bytes32']`. */
  inputs: readonly string[];
  /** 4-byte selector derived from the ABI-declared signature. */
  selector: `0x${string}`;
}

function isFunctionEntry(entry: unknown): entry is AbiEntry {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    (entry as AbiEntry).type === 'function' &&
    typeof (entry as AbiEntry).name === 'string'
  );
}

function isStateChanging(entry: AbiEntry): boolean {
  return entry.stateMutability !== 'view' && entry.stateMutability !== 'pure';
}

function signatureOf(entry: AbiEntry): string {
  const inputs = (entry.inputs ?? [])
    .map((input) => (typeof input?.type === 'string' ? input.type : '?'))
    .join(',');
  return `${String(entry.name)}(${inputs})`;
}

/**
 * Derive the operation-scoped pause entrypoints the pinned ABI genuinely
 * declares. Returns an empty array when the ABI proves no pause authority —
 * which is the honest, fail-closed result for an ABI without pause functions.
 */
export function derivePauseProofs(
  abi: readonly unknown[],
): GuardianPauseProof[] {
  const proofs: GuardianPauseProof[] = [];

  for (const scope of APPROVED_PAUSE_SCOPES) {
    const candidates = PAUSE_ENTRYPOINTS[scope];
    for (const candidate of candidates) {
      const entry = abi.find(
        (item) => isFunctionEntry(item) && item.name === candidate,
      );
      if (!entry || !isFunctionEntry(entry)) continue;
      // A pause must change state on-chain; view/pure cannot pause a module.
      if (!isStateChanging(entry)) continue;

      const inputs = (entry.inputs ?? []).map((i) =>
        typeof i?.type === 'string' ? i.type : '?',
      );
      const signature = signatureOf(entry);
      const selector = keccak256(toHex(signature)).slice(0, 10) as `0x${string}`;
      proofs.push({ scope, functionName: candidate, signature, inputs, selector });
      break;
    }
  }

  return proofs;
}

/** The bytes32 operation-scope identifier used by the canonical entrypoint. */
export function scopeId(scope: GuardianPauseScope): `0x${string}` {
  return keccak256(toHex(scope));
}

// ---------------------------------------------------------------------------
// Authority snapshot
// ---------------------------------------------------------------------------

export type GuardianAuthorityStatus =
  | 'ready'
  | 'manifest_unverified'
  | 'unsupported_chain'
  | 'wrong_network'
  | 'no_abi_pause_support'
  | 'wallet_disconnected'
  | 'authority_unread'
  | 'authority_revoked'
  | 'authority_unknown'
  | 'stale_data';

export interface GuardianAuthorityRead {
  status: 'idle' | 'loading' | 'error' | 'success';
  /** True only when the canonical contract reports the pause role held. */
  hasPauseRole: boolean;
  /** True when the canonical contract reports the role as revoked. */
  revoked: boolean;
  /** Block number the read was observed at; null when unknown. */
  blockNumber: bigint | null;
  error?: string | null;
}

export interface GuardianFreshness {
  status: 'fresh' | 'stale' | 'unknown';
  ageMs?: number | null;
  observedAtBlock?: bigint | null;
}

export interface GuardianProvenance {
  releaseChainId: number | null;
  approvedScopes: readonly GuardianPauseScope[];
  pauseProofs: readonly GuardianPauseProof[];
  observedAtBlock: bigint | null;
}

export interface GuardianPauseSnapshot {
  status: GuardianAuthorityStatus;
  /** True ONLY when every fail-closed condition is satisfied. */
  allowsPause: boolean;
  chainId: number;
  /** ABI-proven, actionable operation scopes (empty when none proven). */
  actionableScopes: readonly GuardianPauseScope[];
  allScopes: readonly GuardianPauseScope[];
  account: `0x${string}` | null;
  guardianAddress: `0x${string}` | null;
  blockingReasons: readonly string[];
  provenance: GuardianProvenance;
}

export interface ResolveGuardianPauseAuthorityInput {
  chainId: number;
  /** Pinned ABI. Defaults to the release `TruthBountyWeighted` ABI. */
  abi?: readonly unknown[];
  /** Release chain id. Defaults to the manifest chain id. */
  releaseChainId?: number | null;
  /** Connected canonical EVM account; null when disconnected. */
  account?: string | null;
  /** Guardian role holder read from canonical contract state; null if unread. */
  guardianAddress?: string | null;
  authorityRead?: GuardianAuthorityRead | null;
  freshness?: GuardianFreshness | null;
  /**
   * Whether the pinned release manifest/ABI was verified. Defaults to false
   * (fail closed) — callers must pass `true` only after verification.
   */
  manifestVerified?: boolean;
}

function safeAbi(): readonly unknown[] {
  try {
    return getContractAbi('TruthBountyWeighted');
  } catch {
    return [];
  }
}

function safeReleaseChainId(): number | null {
  try {
    const id = getReleaseChainId();
    return typeof id === 'number' && Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

function normalizeAddress(value?: string | null): `0x${string}` | null {
  if (!value) return null;
  if (getAddressValidationError(value) !== null) return null;
  return value.toLowerCase() as `0x${string}`;
}

export function isSupportedGuardianChain(chainId: number): boolean {
  return (GUARDIAN_SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId);
}

/**
 * Resolve the fail-closed guardian pause authority snapshot.
 * The returned `allowsPause` is true only when every invariant holds.
 */
export function resolveGuardianPauseAuthority(
  input: ResolveGuardianPauseAuthorityInput,
): GuardianPauseSnapshot {
  const abi = input.abi ?? safeAbi();
  const releaseChainId =
    input.releaseChainId ?? safeReleaseChainId();
  const pauseProofs = derivePauseProofs(abi);
  const actionableScopes = pauseProofs.map((proof) => proof.scope);

  const manifestVerified = input.manifestVerified === true;
  const chainSupported = isSupportedGuardianChain(input.chainId);
  const chainMatchesRelease =
    releaseChainId !== null && input.chainId === releaseChainId;
  const account = normalizeAddress(input.account);
  const guardianAddress = normalizeAddress(input.guardianAddress);
  const read = input.authorityRead ?? null;
  const freshness = input.freshness ?? null;
  const guardianMismatch =
    account !== null && guardianAddress !== null && account !== guardianAddress;

  const blockingReasons: string[] = [];

  if (!manifestVerified) {
    blockingReasons.push(
      'Pinned release manifest/ABI has not been verified for this build.',
    );
  }
  if (!chainSupported) {
    blockingReasons.push(
      `Chain ${input.chainId} is not a supported Optimism/EVM chain.`,
    );
  } else if (!chainMatchesRelease) {
    blockingReasons.push(
      `Wrong network: connected chain ${input.chainId} does not match pinned release chain ${
        releaseChainId ?? 'unknown'
      }.`,
    );
  }
  if (pauseProofs.length === 0) {
    blockingReasons.push(
      'Pinned contract ABI declares no operation-scoped guardian pause entrypoint.',
    );
  }
  if (!account) {
    blockingReasons.push(
      'No canonical EVM guardian account is connected.',
    );
  }
  if (!guardianAddress) {
    blockingReasons.push(
      'Canonical guardian role holder could not be read from contract state.',
    );
  } else if (guardianMismatch) {
    blockingReasons.push(
      'Connected account is not the pinned canonical guardian role holder.',
    );
  }
  if (!read || read.status === 'idle' || read.status === 'loading') {
    blockingReasons.push(
      'Guardian pause authority has not been read from canonical chain state.',
    );
  } else if (read.status === 'error') {
    blockingReasons.push('Guardian pause authority read failed.');
  } else if (read.revoked) {
    blockingReasons.push('Guardian pause authority is revoked on-chain.');
  } else if (!read.hasPauseRole) {
    blockingReasons.push(
      'Connected account does not hold the canonical guardian pause role.',
    );
  }
  if (!freshness || freshness.status === 'unknown') {
    blockingReasons.push('Guardian authority freshness is unknown.');
  } else if (freshness.status === 'stale') {
    blockingReasons.push('Guardian authority data is stale.');
  }

  const status = resolveStatus({
    manifestVerified,
    chainSupported,
    chainMatchesRelease,
    hasPauseProofs: pauseProofs.length > 0,
    account,
    guardianAddress,
    guardianMismatch,
    read,
    freshness,
  });

  return {
    status,
    allowsPause: status === 'ready',
    chainId: input.chainId,
    actionableScopes,
    allScopes: APPROVED_PAUSE_SCOPES,
    account,
    guardianAddress,
    blockingReasons,
    provenance: {
      releaseChainId,
      approvedScopes: APPROVED_PAUSE_SCOPES,
      pauseProofs,
      observedAtBlock: read?.blockNumber ?? freshness?.observedAtBlock ?? null,
    },
  };
}

interface StatusInput {
  manifestVerified: boolean;
  chainSupported: boolean;
  chainMatchesRelease: boolean;
  hasPauseProofs: boolean;
  account: `0x${string}` | null;
  guardianAddress: `0x${string}` | null;
  guardianMismatch: boolean;
  read: GuardianAuthorityRead | null;
  freshness: GuardianFreshness | null;
}

function resolveStatus(input: StatusInput): GuardianAuthorityStatus {
  if (!input.manifestVerified) return 'manifest_unverified';
  if (!input.chainSupported) return 'unsupported_chain';
  if (!input.chainMatchesRelease) return 'wrong_network';
  if (!input.hasPauseProofs) return 'no_abi_pause_support';
  if (!input.account) return 'wallet_disconnected';
  if (!input.guardianAddress) return 'authority_unread';
  if (input.guardianMismatch) return 'authority_unknown';
  if (
    !input.read ||
    input.read.status === 'idle' ||
    input.read.status === 'loading' ||
    input.read.status === 'error'
  ) {
    return 'authority_unread';
  }
  if (input.read.revoked) return 'authority_revoked';
  if (!input.read.hasPauseRole) return 'authority_unknown';
  if (!input.freshness || input.freshness.status !== 'fresh') {
    return 'stale_data';
  }
  return 'ready';
}

export const GUARDIAN_AUTHORITY_LABELS: Record<
  GuardianAuthorityStatus,
  string
> = {
  ready: 'Guardian pause authority verified',
  manifest_unverified: 'Release manifest/ABI not verified',
  unsupported_chain: 'Unsupported chain',
  wrong_network: 'Wrong network',
  no_abi_pause_support: 'No ABI-proven pause authority',
  wallet_disconnected: 'Wallet disconnected',
  authority_unread: 'Guardian authority unread',
  authority_revoked: 'Guardian authority revoked',
  authority_unknown: 'Guardian pause role not held',
  stale_data: 'Guardian authority data stale',
};

// ---------------------------------------------------------------------------
// Request vs. executed (on-chain) pause separation
// ---------------------------------------------------------------------------

export type GuardianPauseRequestState =
  | 'idle'
  | 'requesting'
  | 'submitted'
  | 'rejected'
  | 'failed';

export type GuardianModulePauseState = 'active' | 'paused' | 'unknown';

export interface GuardianModuleState {
  scope: GuardianPauseScope;
  pauseState: GuardianModulePauseState;
  /** Block the canonical read was observed at; null when unread. */
  observedAtBlock: bigint | null;
  /**
   * True ONLY when a canonical on-chain read (not a request) confirms the
   * module is paused. A submitted request never sets this.
   */
  confirmedOnChain: boolean;
}

export interface GuardianPausePhase {
  requestState: GuardianPauseRequestState;
  requestLabel: string;
  onChainState: GuardianModulePauseState;
  onChainLabel: string;
  /** True only for an on-chain confirmed pause — never for a request. */
  isPausedOnChain: boolean;
}

export const GUARDIAN_REQUEST_LABELS: Record<
  GuardianPauseRequestState,
  string
> = {
  idle: 'No pause request initiated',
  requesting: 'Pause request awaiting wallet signature',
  submitted: 'Pause request submitted — awaiting on-chain confirmation',
  rejected: 'Pause request rejected in wallet — nothing executed',
  failed: 'Pause request failed — nothing executed',
};

export const GUARDIAN_MODULE_LABELS: Record<
  GuardianModulePauseState,
  string
> = {
  active: 'Module active (not paused on-chain)',
  paused: 'Module paused on-chain (confirmed)',
  unknown: 'Module pause state unknown (not read)',
};

/**
 * Explain a pause phase, keeping the request and the executed on-chain pause
 * strictly separate. A submitted request NEVER reports the module as paused.
 */
export function describeGuardianPausePhase(
  requestState: GuardianPauseRequestState,
  moduleState?: GuardianModuleState | null,
): GuardianPausePhase {
  const onChainState: GuardianModulePauseState =
    moduleState?.confirmedOnChain === true
      ? moduleState.pauseState
      : 'unknown';

  return {
    requestState,
    requestLabel: GUARDIAN_REQUEST_LABELS[requestState],
    onChainState,
    onChainLabel: GUARDIAN_MODULE_LABELS[onChainState],
    isPausedOnChain: onChainState === 'paused',
  };
}
