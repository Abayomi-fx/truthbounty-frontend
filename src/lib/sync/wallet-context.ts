/**
 * UI-FE-059 — Pure wallet-context coordination policy.
 *
 * The connected wallet scope (`account` + `chainId`) is the context every
 * mutation is bound to. When that scope moves — in this tab or a sibling — the
 * previous context is revoked: its epoch is incremented and the tab fails
 * closed until the user explicitly recovers.
 *
 * This module is framework-free. It reuses the canonical identity rules in
 * `@/lib/wallet/identity` and adds the cross-tab epoch and the resume snapshot
 * that a suspended tab reads when it wakes up.
 */

import {
  classifyWalletIdentityTransition,
  normalizeWalletIdentity,
  type WalletIdentity,
  type WalletIdentityTransition,
} from '@/lib/wallet/identity';

/** Local alias so cross-tab callers do not need to import the wallet module. */
export type WalletContextTransition = WalletIdentityTransition;

export const WALLET_CONTEXT_STORAGE_KEY = 'truthbounty.cross-tab.wallet-context:v1';

export interface WalletContextSnapshot {
  readonly account: `0x${string}` | null;
  readonly chainId: number | null;
  /** Monotonic context generation. Every revocation increments it. */
  readonly epoch: number;
  /** The transition that produced this snapshot. */
  readonly reason: WalletIdentityTransition;
  readonly updatedAt: number;
}

/** A token captured at submit time and re-checked before the write. */
export type ContextGuardToken = number;

export interface ContextGuard {
  /** Capture the current epoch before preparing a mutation. */
  capture(): ContextGuardToken;
  /** True when the captured context is still the active one. */
  isCurrent(token: ContextGuardToken): boolean;
  /** Throw `StaleContextError` when the context was revoked. */
  assertCurrent(token: ContextGuardToken): void;
}

export class StaleContextError extends Error {
  readonly code = 'STALE_CONTEXT' as const;

  constructor() {
    super('The wallet context changed in another tab. Review and retry.');
    this.name = 'StaleContextError';
  }
}

export function normalizeContextIdentity(
  account: string | null | undefined,
  chainId: number | null | undefined,
): WalletIdentity {
  return normalizeWalletIdentity(account, chainId);
}

export function classifyContextTransition(
  previous: WalletIdentity,
  next: WalletIdentity,
): WalletContextTransition {
  return classifyWalletIdentityTransition(previous, next);
}

/** Stable, case-insensitive key for a context (account + chain). */
export function walletContextKey(
  identity: Pick<WalletIdentity, 'address' | 'chainId'>,
): string {
  if (!identity.address) return 'disconnected';
  return `${identity.address.toLowerCase()}:${identity.chainId ?? 'unknown'}`;
}

export function buildWalletContextSnapshot(
  identity: WalletIdentity,
  epoch: number,
  reason: WalletIdentityTransition,
  now: number = Date.now(),
): WalletContextSnapshot {
  return {
    account: identity.address,
    chainId: identity.chainId,
    epoch,
    reason,
    updatedAt: now,
  };
}

/** Transitions that revoke the prior context and force explicit recovery. */
export function transitionRevokesContext(
  transition: WalletIdentityTransition,
): boolean {
  return (
    transition === 'disconnect' ||
    transition === 'account-change' ||
    transition === 'chain-change'
  );
}

/**
 * A tab may mutate only while its live scope matches the authoritative
 * context and no recovery is pending. A stale/revoked context fails closed.
 */
export function contextAllowsMutation(
  liveIdentity: WalletIdentity,
  authoritative: WalletContextSnapshot,
  requiresRecovery: boolean,
): boolean {
  if (requiresRecovery) return false;
  const authoritativeIdentity: WalletIdentity = {
    address: authoritative.account,
    chainId: authoritative.chainId,
  };
  return walletContextKey(liveIdentity) === walletContextKey(authoritativeIdentity);
}

/** Build a guard bound to a getter for the current epoch. */
export function createContextGuard(
  getEpoch: () => number,
): ContextGuard {
  return {
    capture: () => getEpoch(),
    isCurrent: (token) => token === getEpoch(),
    assertCurrent: (token) => {
      if (token !== getEpoch()) throw new StaleContextError();
    },
  };
}

// ---------------------------------------------------------------------------
// Accessible recovery copy
// ---------------------------------------------------------------------------

export interface ContextRecoveryPresentation {
  readonly tone: 'info' | 'warning' | 'error';
  readonly message: string;
}

/**
 * Explicit, user-visible recovery copy for a revoked context. Returns null for
 * transitions that do not require recovery (`none`/`connect`).
 */
export function describeContextRecovery(
  transition: WalletIdentityTransition,
): ContextRecoveryPresentation | null {
  switch (transition) {
    case 'account-change':
      return {
        tone: 'warning',
        message:
          'Your wallet account changed in another tab. Review the new account and reconnect to continue.',
      };
    case 'chain-change':
      return {
        tone: 'warning',
        message:
          'Your wallet network changed in another tab. Switch back to the approved network to continue.',
      };
    case 'disconnect':
      return {
        tone: 'error',
        message:
          'Your wallet disconnected in another tab. Reconnect to continue.',
      };
    case 'connect':
    case 'none':
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Resume snapshot (read on tab wake)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const ACCOUNT_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const REASONS: ReadonlySet<string> = new Set([
  'none',
  'connect',
  'disconnect',
  'account-change',
  'chain-change',
]);

function parseSnapshot(raw: string | null): WalletContextSnapshot | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const account = parsed.account;
  if (account !== null && (typeof account !== 'string' || !ACCOUNT_PATTERN.test(account))) {
    return null;
  }
  const chainId = parsed.chainId;
  if (chainId !== null && typeof chainId !== 'number') return null;
  const epoch = parsed.epoch;
  if (typeof epoch !== 'number' || !Number.isFinite(epoch) || epoch < 0) return null;
  const reason = parsed.reason;
  if (typeof reason !== 'string' || !REASONS.has(reason)) return null;
  const updatedAt = parsed.updatedAt;
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) return null;

  return {
    account: account as `0x${string}` | null,
    chainId: chainId as number | null,
    epoch,
    reason: reason as WalletIdentityTransition,
    updatedAt,
  };
}

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Read the shared resume snapshot. Corrupt/absent snapshots return null. */
export function readWalletContextSnapshot(
  storage: Pick<Storage, 'getItem'> | null = defaultStorage(),
): WalletContextSnapshot | null {
  if (!storage) return null;
  try {
    return parseSnapshot(storage.getItem(WALLET_CONTEXT_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Persist the resume snapshot. Storage failures are non-fatal. */
export function writeWalletContextSnapshot(
  snapshot: WalletContextSnapshot,
  storage: Pick<Storage, 'setItem'> | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(WALLET_CONTEXT_STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}
