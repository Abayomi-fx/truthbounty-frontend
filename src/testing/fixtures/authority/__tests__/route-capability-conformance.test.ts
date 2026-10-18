import { describe, expect, it } from '@jest/globals';
import { NAV_ITEMS } from '@/config/navigation';
import {
  AUTHORITY_FIXTURES,
  AUTHORITY_FIXTURE_IDS,
  CAPABILITY_CONTEXTS,
  CAPABILITY_IDS,
  getAuthorityFixture,
  resolveAllCapabilities,
  selectActiveContext,
} from '../capability-authority';
import {
  CANONICAL_ROUTE_EXPECTATIONS,
  LEGACY_ROUTE_REDIRECTS,
  allowedMutationControls,
  evaluateRouteRead,
  findCanonicalRoute,
  matchesRoutePattern,
  navigableRoutesFor,
  resolveLegacyRedirect,
  type CanonicalRouteExpectation,
} from '../route-authority';

function route(pattern: string): CanonicalRouteExpectation {
  const found = findCanonicalRoute(pattern);
  if (!found) throw new Error(`Missing canonical route: ${pattern}`);
  return found;
}

describe('UI-FE-087 route/capability conformance contexts', () => {
  it('allows every public route for every required context', () => {
    const publicRoutes = CANONICAL_ROUTE_EXPECTATIONS.filter(
      (entry) => entry.read.kind === 'public',
    );

    expect(publicRoutes.length).toBeGreaterThan(0);

    for (const fixture of AUTHORITY_FIXTURES) {
      for (const entry of publicRoutes) {
        expect(evaluateRouteRead(entry, fixture)).toEqual({
          status: 'allowed',
          via: 'public',
          readOnly: false,
        });
      }
    }
  });

  it('denies protected routes to the anonymous visitor', () => {
    const anonymous = getAuthorityFixture('anonymous');
    const protectedRoutes = CANONICAL_ROUTE_EXPECTATIONS.filter(
      (entry) => entry.read.kind !== 'public',
    );

    for (const entry of protectedRoutes) {
      const decision = evaluateRouteRead(entry, anonymous);
      expect(decision.status).toBe('denied');
      if (decision.status === 'denied') {
        expect(decision.reason).toBe('wallet_disconnected');
      }
    }
  });

  it('separates claimant and verifier route access', () => {
    const claimant = getAuthorityFixture('claimant');
    const verifier = getAuthorityFixture('verifier');

    expect(evaluateRouteRead(route('/claims/new'), claimant).status).toBe(
      'allowed',
    );
    expect(
      evaluateRouteRead(route('/dashboard/claims'), claimant).status,
    ).toBe('allowed');
    expect(
      evaluateRouteRead(route('/dashboard/verifications'), claimant).status,
    ).toBe('denied');

    expect(evaluateRouteRead(route('/claims/new'), verifier).status).toBe(
      'denied',
    );
    expect(
      evaluateRouteRead(route('/dashboard/verifications'), verifier).status,
    ).toBe('allowed');
    expect(
      evaluateRouteRead(
        route('/dashboard/verifications/:claimId'),
        verifier,
      ).status,
    ).toBe('allowed');
  });

  it('separates operations, governance, and guardian admin access', () => {
    const operations = getAuthorityFixture('operations');
    const governance = getAuthorityFixture('governance');
    const guardian = getAuthorityFixture('guardian');

    expect(evaluateRouteRead(route('/admin'), operations).status).toBe(
      'allowed',
    );
    expect(
      evaluateRouteRead(route('/admin/operations/:queue'), operations).status,
    ).toBe('allowed');
    expect(evaluateRouteRead(route('/admin/audit'), operations).status).toBe(
      'allowed',
    );
    expect(evaluateRouteRead(route('/dashboard'), operations).status).toBe(
      'denied',
    );

    expect(evaluateRouteRead(route('/admin'), governance).status).toBe(
      'allowed',
    );
    expect(
      evaluateRouteRead(route('/admin/operations/:queue'), governance),
    ).toEqual({ status: 'allowed', via: 'capability', readOnly: true });

    expect(evaluateRouteRead(route('/admin'), guardian).status).toBe(
      'allowed',
    );
    expect(
      evaluateRouteRead(route('/admin/operations/:queue'), guardian).status,
    ).toBe('denied');
    expect(
      evaluateRouteRead(route('/admin/audit'), guardian).status,
    ).toBe('denied');
  });

  it('fails closed for revoked, stale, wrong-chain, and unavailable contexts', () => {
    const revoked = getAuthorityFixture('revoked');
    expect(
      evaluateRouteRead(route('/dashboard/verifications'), revoked),
    ).toEqual({ status: 'denied', reason: 'revoked_authority' });

    const stale = getAuthorityFixture('stale');
    expect(
      evaluateRouteRead(route('/dashboard/verifications'), stale),
    ).toEqual({ status: 'denied', reason: 'stale_authority' });
    expect(evaluateRouteRead(route('/'), stale).status).toBe('allowed');

    const wrongChain = getAuthorityFixture('wrong-chain');
    expect(
      evaluateRouteRead(route('/dashboard/rewards'), wrongChain),
    ).toEqual({ status: 'denied', reason: 'wrong_chain' });
    expect(evaluateRouteRead(route('/claims'), wrongChain).status).toBe(
      'allowed',
    );

    const unavailable = getAuthorityFixture('unavailable');
    expect(evaluateRouteRead(route('/admin'), unavailable)).toEqual({
      status: 'unavailable',
      reason: 'unavailable_authority',
    });
    expect(
      evaluateRouteRead(route('/dashboard'), unavailable),
    ).toEqual({
      status: 'unavailable',
      reason: 'unavailable_authority',
    });
    expect(evaluateRouteRead(route('/docs'), unavailable).status).toBe(
      'allowed',
    );
  });

  it('never grants protected routes by selecting a UI context', () => {
    for (const fixture of AUTHORITY_FIXTURES) {
      const baseline = CANONICAL_ROUTE_EXPECTATIONS.map((entry) =>
        evaluateRouteRead(entry, fixture),
      );

      for (const context of CAPABILITY_CONTEXTS) {
        const selected = selectActiveContext(fixture, context);
        const selectedDecisions = CANONICAL_ROUTE_EXPECTATIONS.map((entry) =>
          evaluateRouteRead(entry, selected),
        );
        expect(selectedDecisions).toEqual(baseline);
      }
    }
  });
});

describe('UI-FE-087 mutation controls', () => {
  it('never exposes a prohibited or ungranted mutation control', () => {
    const prohibited = new Set([
      'override-truth-outcomes',
      'move-another-users-funds',
    ]);

    for (const fixture of AUTHORITY_FIXTURES) {
      for (const entry of CANONICAL_ROUTE_EXPECTATIONS) {
        const controls = allowedMutationControls(entry, fixture);
        for (const control of controls) {
          expect(prohibited.has(control.capability)).toBe(false);
          expect(
            resolveAllCapabilities(fixture)[control.capability],
          ).toBe('granted');
        }
      }
    }
  });

  it('exposes only the controls granted to each context', () => {
    const anonymous = getAuthorityFixture('anonymous');
    const claimant = getAuthorityFixture('claimant');
    const verifier = getAuthorityFixture('verifier');
    const operations = getAuthorityFixture('operations');
    const governance = getAuthorityFixture('governance');
    const guardian = getAuthorityFixture('guardian');

    expect(allowedMutationControls(route('/claims/new'), anonymous)).toEqual(
      [],
    );
    expect(
      allowedMutationControls(route('/claims/:claimId'), anonymous),
    ).toEqual([]);

    expect(
      allowedMutationControls(route('/claims/new'), claimant).map(
        (control) => control.id,
      ),
    ).toEqual(['create-claim', 'manage-draft-evidence']);
    expect(
      allowedMutationControls(route('/claims/:claimId'), claimant).map(
        (control) => control.id,
      ),
    ).toEqual(['open-dispute']);

    expect(
      allowedMutationControls(route('/claims/:claimId'), verifier).map(
        (control) => control.id,
      ),
    ).toEqual(['verify-claim', 'open-dispute']);
    expect(
      allowedMutationControls(
        route('/dashboard/verifications/:claimId'),
        verifier,
      ).map((control) => control.id),
    ).toEqual(['submit-verification']);

    expect(
      allowedMutationControls(route('/admin'), operations),
    ).toEqual([]);
    expect(
      allowedMutationControls(route('/admin/operations/:queue'), operations).map(
        (control) => control.id,
      ),
    ).toEqual(['retry-safe-work']);

    expect(
      allowedMutationControls(route('/admin'), governance).map(
        (control) => control.id,
      ),
    ).toEqual([
      'propose-execute-governance',
      'pause-operation',
      'unpause-upgrade-administer-roles',
    ]);

    expect(
      allowedMutationControls(route('/admin'), guardian).map(
        (control) => control.id,
      ),
    ).toEqual(['pause-operation']);
  });

  it('withholds every mutation control on failure contexts', () => {
    for (const id of [
      'revoked',
      'stale',
      'wrong-chain',
      'unavailable',
    ] as const) {
      const fixture = getAuthorityFixture(id);
      for (const entry of CANONICAL_ROUTE_EXPECTATIONS) {
        expect(allowedMutationControls(entry, fixture)).toEqual([]);
      }
    }
  });
});

describe('UI-FE-087 navigation and redirect conformance', () => {
  it('filters canonical navigation by resolved access', () => {
    const anonymous = navigableRoutesFor(getAuthorityFixture('anonymous'));
    expect(anonymous.every((entry) => entry.visibility === 'public')).toBe(
      true,
    );

    const claimant = navigableRoutesFor(getAuthorityFixture('claimant'));
    expect(claimant.map((entry) => entry.path)).toContain('/dashboard/rewards');
    expect(claimant.map((entry) => entry.path)).not.toContain(
      '/dashboard/verifications',
    );
    expect(claimant.map((entry) => entry.path)).not.toContain('/admin');

    const verifier = navigableRoutesFor(getAuthorityFixture('verifier'));
    expect(verifier.map((entry) => entry.path)).toContain(
      '/dashboard/verifications',
    );
    expect(verifier.map((entry) => entry.path)).not.toContain('/admin');

    const operations = navigableRoutesFor(getAuthorityFixture('operations'));
    expect(operations.map((entry) => entry.path)).toContain('/admin');
    expect(operations.map((entry) => entry.path)).not.toContain(
      '/dashboard/rewards',
    );

    for (const fixture of AUTHORITY_FIXTURES) {
      for (const entry of navigableRoutesFor(fixture)) {
        expect(entry.navigationGroup).not.toBeNull();
        expect(evaluateRouteRead(entry, fixture).status).toBe('allowed');
      }
    }
  });

  it('maps every shipped navigation item to an authority route', () => {
    for (const item of NAV_ITEMS) {
      const redirect = resolveLegacyRedirect(item.href);
      const canonicalPath = redirect?.destination ?? item.href;
      const canonical = findCanonicalRoute(canonicalPath);

      expect(canonical).toBeDefined();
      expect(matchesRoutePattern(canonical!.path, canonicalPath)).toBe(true);

      if (item.requiresRole === 'verifier') {
        expect(
          evaluateRouteRead(
            canonical!,
            getAuthorityFixture('verifier'),
          ).status,
        ).toBe('allowed');
      }
      if (item.requiresRole === 'admin') {
        expect(canonical!.visibility).toBe('admin');
      }
      if (item.requiresAuth) {
        expect(
          evaluateRouteRead(
            canonical!,
            getAuthorityFixture('claimant'),
          ).status,
        ).not.toBe('unavailable');
      }
    }
  });

  it('preserves query and hash across legacy redirects', () => {
    expect(resolveLegacyRedirect('/rewards', '?filter=open', '#top')).toEqual({
      destination: '/dashboard/rewards',
      location: '/dashboard/rewards?filter=open#top',
    });
    expect(resolveLegacyRedirect('/verifier', '?page=2')).toEqual({
      destination: '/dashboard/verifications',
      location: '/dashboard/verifications?page=2',
    });
    expect(resolveLegacyRedirect('/unknown-route')).toBeNull();
  });

  it('keeps every legacy alias out of the authoritative route set', () => {
    const canonicalPatterns = new Set(
      CANONICAL_ROUTE_EXPECTATIONS.map((entry) => entry.path),
    );
    for (const redirect of LEGACY_ROUTE_REDIRECTS) {
      expect(canonicalPatterns.has(redirect.from)).toBe(false);
    }
  });

  it('never treats a redirect as granted authority', () => {
    const visitor = getAuthorityFixture('anonymous');
    const redirect = resolveLegacyRedirect('/rewards');

    expect(redirect).not.toBeNull();
    const destination = route(redirect!.destination);
    expect(evaluateRouteRead(destination, visitor).status).toBe('denied');
  });
});

describe('UI-FE-087 required context coverage', () => {
  it('covers all required contexts and capability rows', () => {
    expect(AUTHORITY_FIXTURE_IDS).toEqual([
      'anonymous',
      'claimant',
      'verifier',
      'operations',
      'governance',
      'guardian',
      'revoked',
      'stale',
      'wrong-chain',
      'unavailable',
    ]);
    expect(CAPABILITY_IDS).toHaveLength(16);
    expect(CAPABILITY_CONTEXTS).toHaveLength(6);
  });
});
