import { describe, expect, it } from '@jest/globals';

/**
 * UI-FE-087 — capability authority conformance.
 *
 * Proves the deterministic fixtures cover the approved role/capability matrix,
 * every required context (anonymous, claimant, verifier, operations,
 * governance, guardian, revoked, stale, wrong-chain, unavailable), and that
 * selecting a presentation context never grants authority.
 */

import {
  AUTHORITY_FIXTURES,
  AUTHORITY_FIXTURE_IDS,
  CAPABILITY_CONTEXTS,
  CAPABILITY_IDS,
  CAPABILITY_MATRIX,
  getAuthorityFixture,
  isCapabilityGranted,
  resolveAllCapabilities,
  resolveCapability,
  selectActiveContext,
  type AuthorityFixture,
  type CapabilityContextId,
  type CapabilityId,
} from '../capability-authority';

function expectCapability(
  fixture: AuthorityFixture,
  capability: CapabilityId,
  expected: ReturnType<typeof resolveCapability>,
): void {
  expect(resolveCapability(capability, fixture)).toBe(expected);
}

describe('UI-FE-087 capability matrix coverage', () => {
  it('defines every capability for every approved context', () => {
    expect(CAPABILITY_IDS).toHaveLength(16);
    expect(CAPABILITY_CONTEXTS).toEqual([
      'visitor',
      'claimant',
      'verifier',
      'operations-administrator',
      'governance-operator',
      'emergency-guardian',
    ]);

    for (const capability of CAPABILITY_IDS) {
      for (const context of CAPABILITY_CONTEXTS) {
        expect(CAPABILITY_MATRIX[capability][context]).toBeDefined();
      }
    }
  });

  it('provides a deterministic fixture for every required context', () => {
    expect(AUTHORITY_FIXTURES.map((fixture) => fixture.id)).toEqual([
      ...AUTHORITY_FIXTURE_IDS,
    ]);
    expect(new Set(AUTHORITY_FIXTURES.map((fixture) => fixture.id)).size).toBe(
      AUTHORITY_FIXTURES.length,
    );

    for (const id of AUTHORITY_FIXTURE_IDS) {
      expect(getAuthorityFixture(id).id).toBe(id);
    }
    expect(() => getAuthorityFixture('unknown' as never)).toThrow();
  });

  it('never grants a prohibited capability to any context', () => {
    for (const fixture of AUTHORITY_FIXTURES) {
      for (const capability of [
        'override-truth-outcomes',
        'move-another-users-funds',
      ] as const) {
        expect(resolveCapability(capability, fixture)).toBe('denied');
        expect(isCapabilityGranted(capability, fixture)).toBe(false);
      }
    }
  });

  it('resolves anonymous visitor capabilities', () => {
    const fixture = getAuthorityFixture('anonymous');

    expectCapability(fixture, 'browse-public-claims', 'granted');
    expectCapability(fixture, 'connect-wallet-session', 'granted');
    expectCapability(fixture, 'create-fund-own-claim', 'denied');
    expectCapability(fixture, 'discover-verification-work', 'denied');
    expectCapability(fixture, 'review-operational-queues', 'denied');
    expectCapability(fixture, 'view-personal-rewards', 'denied');
  });

  it('resolves claimant capabilities', () => {
    const fixture = getAuthorityFixture('claimant');

    expectCapability(fixture, 'create-fund-own-claim', 'granted');
    expectCapability(fixture, 'manage-own-draft-evidence', 'granted');
    expectCapability(fixture, 'open-dispute-appeal', 'granted');
    expectCapability(fixture, 'view-personal-rewards', 'granted');
    expectCapability(fixture, 'withdraw-own-funds-rewards', 'granted');
    expectCapability(fixture, 'discover-verification-work', 'denied');
    expectCapability(fixture, 'review-operational-queues', 'denied');
  });

  it('resolves verifier capabilities without granting claimant authority', () => {
    const fixture = getAuthorityFixture('verifier');

    expectCapability(fixture, 'discover-verification-work', 'granted');
    expectCapability(fixture, 'commit-reveal-submit-verification', 'granted');
    expectCapability(fixture, 'open-dispute-appeal', 'granted');
    expectCapability(fixture, 'view-personal-rewards', 'granted');
    expectCapability(fixture, 'create-fund-own-claim', 'denied');
    expectCapability(fixture, 'review-operational-queues', 'denied');
  });

  it('separates operations, governance, and guardian authority', () => {
    const operations = getAuthorityFixture('operations');
    expectCapability(operations, 'review-operational-queues', 'granted');
    expectCapability(operations, 'retry-safe-idempotent-work', 'granted');
    expectCapability(operations, 'propose-execute-governance', 'denied');
    expectCapability(operations, 'pause-operation', 'denied');
    expectCapability(operations, 'view-personal-rewards', 'denied');

    const governance = getAuthorityFixture('governance');
    expectCapability(governance, 'review-operational-queues', 'read-only');
    expectCapability(governance, 'propose-execute-governance', 'granted');
    expectCapability(governance, 'pause-operation', 'granted');
    expectCapability(
      governance,
      'unpause-upgrade-administer-roles',
      'granted',
    );
    expectCapability(governance, 'retry-safe-idempotent-work', 'denied');

    const guardian = getAuthorityFixture('guardian');
    expectCapability(guardian, 'pause-operation', 'granted');
    expectCapability(guardian, 'propose-execute-governance', 'denied');
    expectCapability(guardian, 'review-operational-queues', 'denied');
    expectCapability(
      guardian,
      'unpause-upgrade-administer-roles',
      'denied',
    );
  });

  it('fails closed for revoked, stale, wrong-chain, and unavailable authority', () => {
    for (const id of ['revoked', 'stale', 'wrong-chain'] as const) {
      const fixture = getAuthorityFixture(id);
      expectCapability(fixture, 'browse-public-claims', 'granted');
      expectCapability(fixture, 'connect-wallet-session', 'granted');
      expectCapability(fixture, 'create-fund-own-claim', 'denied');
      expectCapability(fixture, 'discover-verification-work', 'denied');
      expectCapability(fixture, 'review-operational-queues', 'denied');
    }

    const unavailable = getAuthorityFixture('unavailable');
    expectCapability(unavailable, 'browse-public-claims', 'granted');
    expectCapability(unavailable, 'connect-wallet-session', 'granted');
    expectCapability(unavailable, 'review-operational-queues', 'unavailable');
    expectCapability(unavailable, 'retry-safe-idempotent-work', 'unavailable');
  });

  it('does not grant conditional capabilities without the explicit evidence', () => {
    const verifier = getAuthorityFixture('verifier');
    expectCapability(verifier, 'create-fund-own-claim', 'denied');

    const operationsWithoutRetry = {
      ...getAuthorityFixture('operations'),
      evidence: {
        ...getAuthorityFixture('operations').evidence,
        explicitGrants: [],
      },
    };
    expectCapability(
      operationsWithoutRetry,
      'retry-safe-idempotent-work',
      'denied',
    );

    const governanceWithoutTimelock = {
      ...getAuthorityFixture('governance'),
      evidence: {
        ...getAuthorityFixture('governance').evidence,
        explicitGrants: [],
      },
    };
    expectCapability(
      governanceWithoutTimelock,
      'propose-execute-governance',
      'denied',
    );
    expectCapability(governanceWithoutTimelock, 'pause-operation', 'denied');
  });

  it('never lets a selected UI context grant authority', () => {
    for (const fixture of AUTHORITY_FIXTURES) {
      const baseline = resolveAllCapabilities(fixture);

      for (const context of CAPABILITY_CONTEXTS) {
        const selected = selectActiveContext(
          fixture,
          context as CapabilityContextId,
        );
        expect(selected.evidence.activeContext).toBe(context);
        expect(resolveAllCapabilities(selected)).toEqual(baseline);
      }
    }
  });

  it('derives the same grants from an explicitly visitor-evidenced fixture', () => {
    const visitor = getAuthorityFixture('anonymous');

    for (const selectedContext of CAPABILITY_CONTEXTS) {
      const selected = selectActiveContext(visitor, selectedContext);
      expectCapability(selected, 'browse-public-claims', 'granted');
      expectCapability(selected, 'create-fund-own-claim', 'denied');
      expectCapability(selected, 'commit-reveal-submit-verification', 'denied');
      expectCapability(selected, 'review-operational-queues', 'denied');
      expectCapability(selected, 'propose-execute-governance', 'denied');
    }
  });
});
