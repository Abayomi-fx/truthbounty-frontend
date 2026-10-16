/**
 * V2-FE-047 — Secure SIWE session presentation.
 *
 * Pure helpers that turn a backend EIP-4361 challenge into a structured
 * "sign-in intent" the UI can present verbatim, plus human-readable failure
 * guidance. No React, no wallet SDK, no network.
 *
 * The exact backend `message` is always preserved on the intent so the user
 * reviews precisely what they will sign — no blind signing.
 */

import type {
  SiweChallenge,
  SiweFailure,
  SiweFailureKind,
  SiweStatus,
} from './siwe-types';
import { isChallengeFresh } from './siwe-client';

export interface SiweSignInIntent {
  readonly domain: string;
  readonly uri: string;
  readonly address: string;
  readonly chainId: number;
  readonly nonce: string;
  readonly issuedAt: string;
  readonly expirationTime: string;
  readonly version: string;
  /** Optional EIP-4361 human-readable statement. */
  readonly statement: string;
  /** Optional EIP-4361 resources the session is scoped to. */
  readonly resources: readonly string[];
  /** True when the message's expiration time has passed. */
  readonly expired: boolean;
  /** The exact backend message that will be signed and submitted unchanged. */
  readonly message: string;
}

/**
 * Extract the EIP-4361 `Resources:` list from a SIWE message.
 * Returns an empty array when the message has no resources.
 */
export function parseSiweResources(message: string): string[] {
  if (!message || typeof message !== 'string') return [];
  const match = message.match(
    /(?:^|\r?\n)Resources:[ \t]*\r?\n((?:[ \t]*-[ \t]*[^\r\n]*(?:\r?\n|$))+)/,
  );
  if (!match?.[1]) return [];
  return match[1]
    .split(/\r?\n/)
    .map((line) => line.replace(/^[ \t]*-[ \t]*/, '').trim())
    .filter((line) => line.length > 0);
}

/**
 * Extract the optional EIP-4361 statement paragraph (shown between the account
 * header and the first field). Returns '' when absent.
 */
export function parseSiweStatement(message: string): string {
  if (!message || typeof message !== 'string') return '';
  const match = message.match(
    /Ethereum account:[ \t]*\r?\n[^\r\n]+\r?\n\r?\n([^\r\n]+)\r?\n\r?\nURI:/,
  );
  return match?.[1]?.trim() ?? '';
}

/** Build a presentation-ready sign-in intent from a challenge. */
export function toSiweSignInIntent(
  challenge: SiweChallenge,
  now: number = Date.now(),
): SiweSignInIntent {
  const { expired } = isChallengeFresh(challenge, now);
  return {
    domain: challenge.domain,
    uri: challenge.uri,
    address: challenge.address,
    chainId: challenge.chainId,
    nonce: challenge.nonce,
    issuedAt: challenge.issuedAt,
    expirationTime: challenge.expirationTime,
    version: challenge.version,
    statement: parseSiweStatement(challenge.message),
    resources: parseSiweResources(challenge.message),
    expired,
    message: challenge.message,
  };
}

// ---------------------------------------------------------------------------
// Failure guidance
// ---------------------------------------------------------------------------

export interface SiweFailurePresentation {
  readonly kind: SiweFailureKind;
  readonly title: string;
  readonly message: string;
  readonly recovery: string;
  /** Retry the same challenge (e.g. after a user rejection). */
  readonly canRetry: boolean;
  /** Request a fresh challenge from the backend. */
  readonly canRequestNewChallenge: boolean;
}

type FailureTemplate = Omit<SiweFailurePresentation, 'kind' | 'message'>;

const FAILURE_TEMPLATES: Record<SiweFailureKind, FailureTemplate> = {
  USER_REJECTED: {
    title: 'Signature declined',
    recovery: 'Approve the signature request in your wallet to sign in.',
    canRetry: true,
    canRequestNewChallenge: true,
  },
  WRONG_ACCOUNT: {
    title: 'Wrong account',
    recovery:
      'Switch to the account named in the sign-in request, then request a new sign-in.',
    canRetry: false,
    canRequestNewChallenge: true,
  },
  WRONG_CHAIN: {
    title: 'Wrong network',
    recovery: 'Switch to the requested network, then request a new sign-in.',
    canRetry: false,
    canRequestNewChallenge: true,
  },
  NONCE_EXPIRED: {
    title: 'Sign-in request expired',
    recovery: 'Request a new sign-in request and try again.',
    canRetry: false,
    canRequestNewChallenge: true,
  },
  REPLAYED: {
    title: 'Sign-in request already used',
    recovery: 'Request a new sign-in request and try again.',
    canRetry: false,
    canRequestNewChallenge: true,
  },
  INVALID_MESSAGE: {
    title: 'Unsafe sign-in request',
    recovery:
      'Do not sign. Request a new sign-in request from a trusted session.',
    canRetry: false,
    canRequestNewChallenge: true,
  },
  UNAUTHORIZED: {
    title: 'Sign-in failed',
    recovery: 'Try signing in again.',
    canRetry: true,
    canRequestNewChallenge: true,
  },
  NETWORK: {
    title: 'Connection problem',
    recovery: 'Check your connection and try again.',
    canRetry: true,
    canRequestNewChallenge: true,
  },
};

/** Turn a typed failure into accessible, recovery-oriented copy. */
export function describeSiweFailure(
  failure: SiweFailure | null | undefined,
): SiweFailurePresentation {
  const kind: SiweFailureKind = failure?.kind ?? 'NETWORK';
  const template = FAILURE_TEMPLATES[kind];
  return {
    kind,
    title: template.title,
    message: failure?.message?.trim() || template.title,
    recovery: template.recovery,
    canRetry: template.canRetry,
    canRequestNewChallenge: template.canRequestNewChallenge,
  };
}

/**
 * Deterministic text for the accessible status live region. Never fabricates
 * progress beyond the reported status.
 */
export function siweStatusAnnouncement(
  status: SiweStatus,
  error?: SiweFailure | null,
): string {
  switch (status) {
    case 'requesting-challenge':
      return 'Requesting a sign-in request from the server.';
    case 'ready-to-sign':
      return 'Sign-in request ready. Review the details before signing.';
    case 'signing':
      return 'Waiting for your wallet signature. Confirm in your wallet.';
    case 'submitting':
      return 'Verifying your signature.';
    case 'authenticated':
      return 'Signed in.';
    case 'error':
      return error ? describeSiweFailure(error).message : 'Sign-in failed.';
    case 'idle':
    default:
      return 'Not signed in.';
  }
}
