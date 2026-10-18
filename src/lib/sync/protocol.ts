/**
 * UI-FE-059 — Cross-tab wallet & session context protocol.
 *
 * A single, versioned, bounded event envelope shared by every cross-tab
 * synchronization channel. Events carry only the non-sensitive coordination
 * metadata a sibling tab needs to converge (identity scope, state reason,
 * consent choice, transaction id). They never carry a session token,
 * signature, authorization header, calldata, or any other protected payload.
 *
 * The protocol is pure: no storage, no broadcast, no React. Transport lives in
 * `./channel`. Every inbound payload is treated as untrusted and re-derived
 * from an explicit field allow-list.
 */

export const CROSS_TAB_PROTOCOL_VERSION = 1 as const;

/** Hard upper bound for a serialized event. Oversized frames are dropped. */
export const CROSS_TAB_MAX_BYTES = 4 * 1024;

export type CrossTabEventKind =
  | 'wallet-context'
  | 'session-state'
  | 'consent'
  | 'pending-transaction';

export type WalletContextReason =
  | 'connect'
  | 'disconnect'
  | 'account-change'
  | 'chain-change';

export type SessionStateReason = 'expired' | 'revoked' | 'manual' | 'reused';

export type ConsentChoice = 'granted' | 'denied' | 'cleared';

export type PendingTransactionAction = 'registered' | 'settled';

interface CrossTabEnvelopeBase {
  readonly v: typeof CROSS_TAB_PROTOCOL_VERSION;
  readonly kind: CrossTabEventKind;
  /** Stable per-tab identifier used only for loop/replay suppression. */
  readonly sender: string;
  /** Monotonic per-sender sequence number. */
  readonly seq: number;
  /** Wall-clock emission time (for diagnostics only, never trusted for gating). */
  readonly at: number;
}

/**
 * Wallet identity moved in another tab. `account`/`chainId` are public
 * on-chain values; `epoch` is the origin tab's monotonic context generation.
 */
export interface WalletContextEvent extends CrossTabEnvelopeBase {
  readonly kind: 'wallet-context';
  readonly reason: WalletContextReason;
  readonly account: `0x${string}` | null;
  readonly chainId: number | null;
  readonly epoch: number;
}

/** A session reached a terminal state. Carries no token material whatsoever. */
export interface SessionStateEvent extends CrossTabEnvelopeBase {
  readonly kind: 'session-state';
  readonly reason: SessionStateReason;
  readonly epoch: number;
}

/** Optional analytics consent was changed. */
export interface ConsentEvent extends CrossTabEnvelopeBase {
  readonly kind: 'consent';
  readonly choice: ConsentChoice;
}

/** A mutation entered or left the pending set. Only the opaque id is shared. */
export interface PendingTransactionEvent extends CrossTabEnvelopeBase {
  readonly kind: 'pending-transaction';
  readonly action: PendingTransactionAction;
  readonly id: string;
  readonly chainId: number | null;
}

export type CrossTabEvent =
  | WalletContextEvent
  | SessionStateEvent
  | ConsentEvent
  | PendingTransactionEvent;

/** A payload without the transport envelope; the channel stamps `sender/seq/at`. */
export type CrossTabPayload =
  | Pick<WalletContextEvent, 'kind' | 'reason' | 'account' | 'chainId' | 'epoch'>
  | Pick<SessionStateEvent, 'kind' | 'reason' | 'epoch'>
  | Pick<ConsentEvent, 'kind' | 'choice'>
  | Pick<PendingTransactionEvent, 'kind' | 'action' | 'id' | 'chainId'>;

export interface CrossTabStamp {
  readonly sender: string;
  readonly seq: number;
  readonly at: number;
}

// ---------------------------------------------------------------------------
// Privacy scanning
// ---------------------------------------------------------------------------

/** Keys whose presence would indicate protected material in a frame. */
const PROTECTED_KEYS =
  /"(token|secret|authorization|password|privatekey|private_key|apikey|api_key|cookie|signature|calldata|jwt|bearer|siwe)"\s*:/i;

/** A long (>=32 byte) hex blob: signatures, hashes, or encoded payloads. */
const LONG_HEX = /0x[0-9a-fA-F]{64,}/;

/**
 * Return true when a serialized frame carries anything that looks like a
 * token, signature, or other protected payload. Account addresses (20 bytes)
 * and small counters are deliberately allowed.
 */
export function containsProtectedMaterial(serialized: string): boolean {
  return PROTECTED_KEYS.test(serialized) || LONG_HEX.test(serialized);
}

function byteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
}

// ---------------------------------------------------------------------------
// Building & serializing
// ---------------------------------------------------------------------------

/** Build a fully stamped event from an allow-listed payload. */
export function buildCrossTabEvent(
  payload: CrossTabPayload,
  stamp: CrossTabStamp,
): CrossTabEvent {
  return {
    v: CROSS_TAB_PROTOCOL_VERSION,
    ...payload,
    sender: stamp.sender,
    seq: stamp.seq,
    at: stamp.at,
  } as CrossTabEvent;
}

export interface SerializeResult {
  readonly ok: boolean;
  readonly value: string | null;
}

/**
 * Serialize an event, failing closed when it is oversized or would leak
 * protected material. Callers must not transmit when `ok` is false.
 */
export function serializeCrossTabEvent(event: CrossTabEvent): SerializeResult {
  let serialized: string;
  try {
    serialized = JSON.stringify(event);
  } catch {
    return { ok: false, value: null };
  }
  if (byteLength(serialized) > CROSS_TAB_MAX_BYTES) {
    return { ok: false, value: null };
  }
  if (containsProtectedMaterial(serialized)) {
    return { ok: false, value: null };
  }
  return { ok: true, value: serialized };
}

// ---------------------------------------------------------------------------
// Parsing untrusted input
// ---------------------------------------------------------------------------

const WALLET_REASONS: ReadonlySet<string> = new Set([
  'connect',
  'disconnect',
  'account-change',
  'chain-change',
]);

const SESSION_REASONS: ReadonlySet<string> = new Set([
  'expired',
  'revoked',
  'manual',
  'reused',
]);

const CONSENT_CHOICES: ReadonlySet<string> = new Set([
  'granted',
  'denied',
  'cleared',
]);

const TRANSACTION_ACTIONS: ReadonlySet<string> = new Set([
  'registered',
  'settled',
]);

const ACCOUNT_PATTERN = /^0x[0-9a-fA-F]{40}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function readEnvelope(
  value: Record<string, unknown>,
): { sender: string; seq: number; at: number } | null {
  if (value.v !== CROSS_TAB_PROTOCOL_VERSION) return null;
  if (typeof value.sender !== 'string' || value.sender.length === 0) return null;
  if (!isFiniteNumber(value.seq) || value.seq < 0) return null;
  if (!isFiniteNumber(value.at)) return null;
  return { sender: value.sender, seq: value.seq, at: value.at };
}

function readAccount(value: unknown): `0x${string}` | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && ACCOUNT_PATTERN.test(value)) {
    return value as `0x${string}`;
  }
  return undefined;
}

function readChainId(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  return isFiniteNumber(value) ? value : undefined;
}

/**
 * Validate an untrusted cross-tab payload. Returns null for malformed,
 * unknown-version, oversized, or secret-bearing frames. The returned event is
 * rebuilt from the allow-list, so unknown/extra fields are always dropped.
 */
export function parseCrossTabEvent(raw: unknown): CrossTabEvent | null {
  if (!isRecord(raw)) return null;

  let serialized: string;
  try {
    serialized = JSON.stringify(raw);
  } catch {
    return null;
  }
  if (byteLength(serialized) > CROSS_TAB_MAX_BYTES) return null;
  if (containsProtectedMaterial(serialized)) return null;

  const envelope = readEnvelope(raw);
  if (!envelope) return null;
  const { sender, seq, at } = envelope;

  switch (raw.kind) {
    case 'wallet-context': {
      if (typeof raw.reason !== 'string' || !WALLET_REASONS.has(raw.reason)) {
        return null;
      }
      if (!isFiniteNumber(raw.epoch) || raw.epoch < 0) return null;
      const account = readAccount(raw.account);
      if (account === undefined) return null;
      const chainId = readChainId(raw.chainId);
      if (chainId === undefined) return null;
      return {
        v: CROSS_TAB_PROTOCOL_VERSION,
        kind: 'wallet-context',
        reason: raw.reason as WalletContextReason,
        account,
        chainId,
        epoch: raw.epoch,
        sender,
        seq,
        at,
      };
    }
    case 'session-state': {
      if (typeof raw.reason !== 'string' || !SESSION_REASONS.has(raw.reason)) {
        return null;
      }
      if (!isFiniteNumber(raw.epoch) || raw.epoch < 0) return null;
      return {
        v: CROSS_TAB_PROTOCOL_VERSION,
        kind: 'session-state',
        reason: raw.reason as SessionStateReason,
        epoch: raw.epoch,
        sender,
        seq,
        at,
      };
    }
    case 'consent': {
      if (typeof raw.choice !== 'string' || !CONSENT_CHOICES.has(raw.choice)) {
        return null;
      }
      return {
        v: CROSS_TAB_PROTOCOL_VERSION,
        kind: 'consent',
        choice: raw.choice as ConsentChoice,
        sender,
        seq,
        at,
      };
    }
    case 'pending-transaction': {
      if (typeof raw.action !== 'string' || !TRANSACTION_ACTIONS.has(raw.action)) {
        return null;
      }
      if (typeof raw.id !== 'string' || raw.id.length === 0 || raw.id.length > 128) {
        return null;
      }
      const chainId = readChainId(raw.chainId);
      if (chainId === undefined) return null;
      return {
        v: CROSS_TAB_PROTOCOL_VERSION,
        kind: 'pending-transaction',
        action: raw.action as PendingTransactionAction,
        id: raw.id,
        chainId,
        sender,
        seq,
        at,
      };
    }
    default:
      return null;
  }
}
