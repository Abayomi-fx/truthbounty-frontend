/**
 * Appeal projection read layer.
 *
 * The pinned `TruthBountyWeighted` ABI exposes no appeal-context getters, so
 * appeal snapshot, deadline, stake bounds and wallet position cannot be derived
 * on-chain. They are only available from the canonical API projection, which
 * mirrors the contract and serves the caller's own position.
 *
 * This module is intentionally the *only* source of appeal context. It never
 * synthesises values: an unreachable, malformed or incomplete projection raises
 * `AppealProjectionError` so callers fail closed.
 */

import type {
  AppealDecision,
  AppealDeadline,
  AppealSnapshot,
  AppealStakeBounds,
  AppealWalletPosition,
} from '@/app/types/appeal';

export class AppealProjectionError extends Error {
  readonly code:
    | 'UNAVAILABLE'
    | 'NOT_FOUND'
    | 'UNAUTHORIZED'
    | 'MALFORMED'
    | 'CHAIN_MISMATCH';

  constructor(
    code: AppealProjectionError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'AppealProjectionError';
    this.code = code;
  }
}

/** Raw projection payload as served by `GET /api/appeals/:appealId`. */
export interface AppealProjectionPayload {
  appealId: string;
  /** Chain the projection was computed for; must match the pinned release chain. */
  chainId: number;
  snapshot: AppealSnapshot;
  deadline: AppealDeadline;
  stakeBounds: AppealStakeBounds;
  position: AppealWalletPosition;
}

export interface AppealProjection {
  snapshot: AppealSnapshot;
  deadline: AppealDeadline;
  stakeBounds: AppealStakeBounds;
  walletPosition: AppealWalletPosition;
}

const HEX_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const UINT = /^\d+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function fail(code: AppealProjectionError['code'], message: string): never {
  throw new AppealProjectionError(code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requireString(
  source: Record<string, unknown>,
  key: string,
  label: string,
  pattern?: RegExp,
): string {
  const value = source[key];
  if (typeof value !== 'string' || value.length === 0) {
    fail('MALFORMED', `${label}.${key} must be a non-empty string.`);
  }
  if (pattern && !pattern.test(value)) {
    fail('MALFORMED', `${label}.${key} has an unexpected format.`);
  }
  return value;
}

function requireInteger(
  source: Record<string, unknown>,
  key: string,
  label: string,
): number {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail('MALFORMED', `${label}.${key} must be a number.`);
  }
  return value;
}

function requireBoolean(
  source: Record<string, unknown>,
  key: string,
  label: string,
): boolean {
  const value = source[key];
  if (typeof value !== 'boolean') {
    fail('MALFORMED', `${label}.${key} must be a boolean.`);
  }
  return value;
}

function parseSnapshot(raw: unknown): AppealSnapshot {
  if (!isRecord(raw)) fail('MALFORMED', 'snapshot must be an object.');
  const decision = raw.firstRoundDecision;
  if (decision !== 'VERIFIED' && decision !== 'REJECTED') {
    fail('MALFORMED', 'snapshot.firstRoundDecision is invalid.');
  }
  if (raw.existingDecision !== undefined) {
    fail('MALFORMED', 'snapshot must not carry wallet position fields.');
  }

  return {
    appealId: requireString(raw, 'appealId', 'snapshot'),
    claimId: requireString(raw, 'claimId', 'snapshot'),
    disputeId: requireString(raw, 'disputeId', 'snapshot'),
    initiatorAddress: requireString(raw, 'initiatorAddress', 'snapshot', HEX_ADDRESS),
    initiatorStake: requireString(raw, 'initiatorStake', 'snapshot', UINT),
    firstRoundDecision: decision,
    firstRoundVotesFor: requireInteger(raw, 'firstRoundVotesFor', 'snapshot'),
    firstRoundVotesAgainst: requireInteger(raw, 'firstRoundVotesAgainst', 'snapshot'),
    reason: requireString(raw, 'reason', 'snapshot'),
    initiatedAt: requireString(raw, 'initiatedAt', 'snapshot', ISO_DATE),
    blockNumber: requireInteger(raw, 'blockNumber', 'snapshot'),
  };
}

function parseDeadline(raw: unknown): AppealDeadline {
  if (!isRecord(raw)) fail('MALFORMED', 'deadline must be an object.');

  return {
    appealId: requireString(raw, 'appealId', 'deadline'),
    startTime: requireString(raw, 'startTime', 'deadline', ISO_DATE),
    endTime: requireString(raw, 'endTime', 'deadline', ISO_DATE),
    timeRemaining: requireInteger(raw, 'timeRemaining', 'deadline'),
    endBlock: requireInteger(raw, 'endBlock', 'deadline'),
    currentBlock: requireInteger(raw, 'currentBlock', 'deadline'),
    blocksRemaining: requireInteger(raw, 'blocksRemaining', 'deadline'),
    isActive: requireBoolean(raw, 'isActive', 'deadline'),
    hasEnded: requireBoolean(raw, 'hasEnded', 'deadline'),
  };
}

function parseStakeBounds(raw: unknown): AppealStakeBounds {
  if (!isRecord(raw)) fail('MALFORMED', 'stakeBounds must be an object.');

  const bounds: AppealStakeBounds = {
    appealId: requireString(raw, 'appealId', 'stakeBounds'),
    minStake: requireString(raw, 'minStake', 'stakeBounds', UINT),
    totalSupportStake: requireString(
      raw,
      'totalSupportStake',
      'stakeBounds',
      UINT,
    ),
    totalOpposeStake: requireString(
      raw,
      'totalOpposeStake',
      'stakeBounds',
      UINT,
    ),
    supporterCount: requireInteger(raw, 'supporterCount', 'stakeBounds'),
    opposerCount: requireInteger(raw, 'opposerCount', 'stakeBounds'),
  };

  for (const optional of ['maxStake', 'recommendedStake'] as const) {
    const value = raw[optional];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string' || !UINT.test(value)) {
      fail('MALFORMED', `stakeBounds.${optional} must be a uint string.`);
    }
    bounds[optional] = value;
  }

  return bounds;
}

function parsePosition(
  raw: unknown,
  userAddress: string,
): AppealWalletPosition {
  if (!isRecord(raw)) fail('MALFORMED', 'position must be an object.');

  const hasParticipated = requireBoolean(raw, 'hasParticipated', 'position');
  if (requireString(raw, 'userAddress', 'position', HEX_ADDRESS) !== userAddress) {
    fail('MALFORMED', 'position.userAddress does not match the connected wallet.');
  }
  if (raw.existingDecision !== undefined) {
    const decision = raw.existingDecision;
    if (decision !== 'SUPPORT' && decision !== 'OPPOSE') {
      fail('MALFORMED', 'position.existingDecision is invalid.');
    }
  }

  const position: AppealWalletPosition = {
    appealId: requireString(raw, 'appealId', 'position'),
    userAddress: requireString(raw, 'userAddress', 'position', HEX_ADDRESS),
    hasParticipated,
    currentBalance: requireString(raw, 'currentBalance', 'position', UINT),
    hasMinimumBalance: requireBoolean(raw, 'hasMinimumBalance', 'position'),
  };

  if (hasParticipated) {
    if (raw.existingDecision === undefined) {
      fail(
        'MALFORMED',
        'position.existingDecision is required when hasParticipated is true.',
      );
    }
    position.existingDecision = raw.existingDecision as AppealDecision;
  } else if (raw.existingDecision !== undefined) {
    fail(
      'MALFORMED',
      'position.existingDecision must be absent when hasParticipated is false.',
    );
  }

  if (raw.existingStake !== undefined) {
    position.existingStake = requireString(
      raw,
      'existingStake',
      'position',
      UINT,
    );
  }
  if (raw.participatedAt !== undefined) {
    position.participatedAt = requireString(
      raw,
      'participatedAt',
      'position',
      ISO_DATE,
    );
  }
  if (raw.transactionHash !== undefined) {
    position.transactionHash = requireString(
      raw,
      'transactionHash',
      'position',
      /^0x[a-fA-F0-9]{64}$/,
    );
  }

  return position;
}

/**
 * Validate a raw projection payload.
 *
 * Throws `AppealProjectionError` on any inconsistency. Cross-field coherence
 * (ids, chain, block arithmetic) is checked here so a partially-correct payload
 * can never reach eligibility computation.
 */
export function parseAppealProjection(
  raw: unknown,
  options: {
    appealId: string;
    userAddress: string;
    expectedChainId: number;
  },
): AppealProjection {
  if (!isRecord(raw)) {
    fail('MALFORMED', 'Appeal projection must be an object.');
  }

  const { appealId, userAddress, expectedChainId } = options;

  if (requireString(raw, 'appealId', 'projection') !== appealId) {
    fail('MALFORMED', 'Projection appealId does not match the requested appeal.');
  }
  if (requireInteger(raw, 'chainId', 'projection') !== expectedChainId) {
    fail(
      'CHAIN_MISMATCH',
      `Projection chain ${String(raw.chainId)} does not match the pinned release chain ${expectedChainId}.`,
    );
  }

  const snapshot = parseSnapshot(raw.snapshot);
  const deadline = parseDeadline(raw.deadline);
  const stakeBounds = parseStakeBounds(raw.stakeBounds);
  const walletPosition = parsePosition(raw.position, userAddress);

  for (const [value, label] of [
    [snapshot.appealId, 'snapshot.appealId'],
    [deadline.appealId, 'deadline.appealId'],
    [stakeBounds.appealId, 'stakeBounds.appealId'],
    [walletPosition.appealId, 'position.appealId'],
  ] as const) {
    if (value !== appealId) {
      fail('MALFORMED', `${label} does not match the requested appeal.`);
    }
  }

  if (deadline.blocksRemaining < 0) {
    fail('MALFORMED', 'deadline.blocksRemaining must not be negative.');
  }
  if (deadline.isActive === deadline.hasEnded) {
    fail('MALFORMED', 'deadline.isActive and deadline.hasEnded are contradictory.');
  }
  if (Number.isNaN(Date.parse(deadline.endTime))) {
    fail('MALFORMED', 'deadline.endTime is not a valid ISO 8601 timestamp.');
  }

  return { snapshot, deadline, stakeBounds, walletPosition };
}

/** Injected fetcher, so tests never depend on ambient `fetch`. */
export type AppealProjectionFetcher = (
  appealId: string,
  signal?: AbortSignal,
) => Promise<unknown>;

const defaultFetcher: AppealProjectionFetcher = async (appealId) => {
  let response: Response;
  try {
    response = await fetch(`/api/appeals/${encodeURIComponent(appealId)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch (err) {
    fail(
      'UNAVAILABLE',
      `Appeal projection request failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  if (response.status === 404) {
    fail('NOT_FOUND', `Appeal ${appealId} was not found.`);
  }
  if (response.status === 401 || response.status === 403) {
    fail('UNAUTHORIZED', `Not authorised to read appeal ${appealId}.`);
  }
  if (!response.ok) {
    fail(
      'UNAVAILABLE',
      `Appeal projection request failed with status ${response.status}.`,
    );
  }

  try {
    return await response.json();
  } catch (err) {
    fail(
      'MALFORMED',
      `Appeal projection response was not valid JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
};

/**
 * Load and validate the appeal projection for a wallet.
 *
 * Fails closed: any transport, status, shape or coherence problem throws.
 */
export async function loadAppealProjection(
  appealId: string,
  options: {
    userAddress: string;
    expectedChainId: number;
    fetcher?: AppealProjectionFetcher;
    signal?: AbortSignal;
  },
): Promise<AppealProjection> {
  const { userAddress, expectedChainId, fetcher = defaultFetcher, signal } = options;

  const raw = await fetcher(appealId, signal);
  return parseAppealProjection(raw, { appealId, userAddress, expectedChainId });
}
