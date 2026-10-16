/**
 * V2-FE-047 — SIWE presentation helpers (pure unit tests).
 *
 * Proves the sign-in intent exposes the exact message and every safety-relevant
 * field (domain, chain, nonce, expiry, resources), and that failures map to
 * actionable, recovery-oriented copy.
 */

import type { SiweChallenge, SiweFailureKind } from '../siwe-types';
import {
  describeSiweFailure,
  parseSiweResources,
  parseSiweStatement,
  siweStatusAnnouncement,
  toSiweSignInIntent,
} from '../siwe-presentation';

const MESSAGE = `truthbounty.app wants you to sign in with your Ethereum account:
0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E

Sign in to TruthBounty.

URI: https://truthbounty.app
Version: 1
Chain ID: 10
Nonce: abc123XYZ
Issued At: 2026-08-31T00:00:00.000Z
Expiration Time: 2026-09-01T00:00:00.000Z
Resources:
- https://truthbounty.app/terms
- https://api.truthbounty.app`;

const CHALLENGE: SiweChallenge = {
  message: MESSAGE,
  nonce: 'abc123XYZ',
  address: '0x742d35cc6634c0532925a3b844bc9e7595f0eb1e',
  chainId: 10,
  issuedAt: '2026-08-31T00:00:00.000Z',
  expirationTime: '2026-09-01T00:00:00.000Z',
  domain: 'truthbounty.app',
  uri: 'https://truthbounty.app',
  version: '1',
};

const BEFORE_EXPIRY = Date.parse('2026-08-31T12:00:00.000Z');
const AFTER_EXPIRY = Date.parse('2026-09-01T12:00:00.000Z');

describe('parseSiweResources', () => {
  it('extracts the EIP-4361 resources list', () => {
    expect(parseSiweResources(MESSAGE)).toEqual([
      'https://truthbounty.app/terms',
      'https://api.truthbounty.app',
    ]);
  });

  it('returns an empty array when there are no resources', () => {
    expect(parseSiweResources(MESSAGE.split('Resources:')[0])).toEqual([]);
    expect(parseSiweResources('')).toEqual([]);
  });
});

describe('parseSiweStatement', () => {
  it('extracts the optional statement paragraph', () => {
    expect(parseSiweStatement(MESSAGE)).toBe('Sign in to TruthBounty.');
  });

  it('returns empty string when the statement is absent', () => {
    const noStatement = MESSAGE.replace('\nSign in to TruthBounty.\n', '\n');
    expect(parseSiweStatement(noStatement)).toBe('');
  });
});

describe('toSiweSignInIntent', () => {
  it('presents the exact message and every safety-relevant field', () => {
    const intent = toSiweSignInIntent(CHALLENGE, BEFORE_EXPIRY);

    expect(intent.message).toBe(MESSAGE); // verbatim
    expect(intent.domain).toBe('truthbounty.app');
    expect(intent.uri).toBe('https://truthbounty.app');
    expect(intent.chainId).toBe(10);
    expect(intent.nonce).toBe('abc123XYZ');
    expect(intent.expirationTime).toBe('2026-09-01T00:00:00.000Z');
    expect(intent.resources).toHaveLength(2);
    expect(intent.statement).toBe('Sign in to TruthBounty.');
    expect(intent.expired).toBe(false);
  });

  it('flags an expired challenge without altering the message', () => {
    const intent = toSiweSignInIntent(CHALLENGE, AFTER_EXPIRY);
    expect(intent.expired).toBe(true);
    expect(intent.message).toBe(MESSAGE);
  });
});

describe('describeSiweFailure', () => {
  const kinds: SiweFailureKind[] = [
    'USER_REJECTED',
    'WRONG_ACCOUNT',
    'WRONG_CHAIN',
    'NONCE_EXPIRED',
    'REPLAYED',
    'INVALID_MESSAGE',
    'UNAUTHORIZED',
    'NETWORK',
  ];

  it('maps every failure kind to recovery guidance', () => {
    for (const kind of kinds) {
      const presentation = describeSiweFailure({ kind, message: `${kind} happened` });
      expect(presentation.kind).toBe(kind);
      expect(presentation.title.length).toBeGreaterThan(0);
      expect(presentation.recovery.length).toBeGreaterThan(0);
      expect(presentation.message).toBe(`${kind} happened`);
    }
  });

  it('only allows retry for recoverable failures', () => {
    expect(describeSiweFailure({ kind: 'USER_REJECTED', message: 'x' }).canRetry).toBe(true);
    expect(describeSiweFailure({ kind: 'NONCE_EXPIRED', message: 'x' }).canRetry).toBe(false);
    expect(
      describeSiweFailure({ kind: 'NONCE_EXPIRED', message: 'x' }).canRequestNewChallenge,
    ).toBe(true);
  });

  it('warns the user not to sign on an invalid message', () => {
    expect(
      describeSiweFailure({ kind: 'INVALID_MESSAGE', message: 'bad' }).recovery,
    ).toMatch(/do not sign/i);
  });

  it('falls back safely for missing failures', () => {
    const presentation = describeSiweFailure(null);
    expect(presentation.title.length).toBeGreaterThan(0);
  });
});

describe('siweStatusAnnouncement', () => {
  it('returns deterministic copy for each status', () => {
    expect(siweStatusAnnouncement('idle')).toMatch(/not signed in/i);
    expect(siweStatusAnnouncement('requesting-challenge')).toMatch(/requesting/i);
    expect(siweStatusAnnouncement('ready-to-sign')).toMatch(/review/i);
    expect(siweStatusAnnouncement('signing')).toMatch(/wallet signature/i);
    expect(siweStatusAnnouncement('submitting')).toMatch(/verifying/i);
    expect(siweStatusAnnouncement('authenticated')).toMatch(/signed in/i);
    expect(siweStatusAnnouncement('error', { kind: 'REPLAYED', message: 'used' })).toBe('used');
  });
});
