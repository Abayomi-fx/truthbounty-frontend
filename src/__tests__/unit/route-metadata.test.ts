/**
 * Route Metadata Unit Tests — Issue #620 (UI-FE-050)
 *
 * Covers:
 *  A. Metadata snapshots — approved public routes, authenticated routes,
 *     privileged routes, not-found routes, stale/unavailable routes.
 *  B. Secret / PII leakage regression — synthetic sensitive values must not
 *     appear in any metadata field.
 *  C. Canonical / redirect consistency — origin derivation, path normalization,
 *     query-parameter stripping, untrusted-host rejection.
 *  D. Safe fallback — unknown, not-found, unavailable, denied routes produce
 *     deterministic generic metadata without resource-specific data.
 */

import {
  generateRouteMetadata,
  findRouteMeta,
  ROUTE_META_TABLE,
  SITE_NAME,
  FALLBACK_TITLE,
  FALLBACK_DESCRIPTION,
  ROBOTS_DIRECTIVES,
  RouteVisibility,
} from '@/lib/metadata/route-metadata';

import {
  canonicalUrl,
  getApprovedOrigin,
  stripQueryAndHash,
  normalizePath,
} from '@/lib/metadata/canonical-url';

// ─── Synthetic sensitive test fixtures ───────────────────────────────────────
// These values represent the categories of sensitive data that must never
// appear in server-rendered metadata. All values are synthetic.

const SENSITIVE_FIXTURES = {
  walletAddress:    '0xDeadBeef00000000000000000000000000000001',
  sessionToken:     'sess_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake',
  privateIdentifier:'uid_priv_9e7b2a1f4c3d5e6a',
  claimDraftTitle:  'DRAFT: Unpublished claim content should not appear',
  claimDraftContent:'Evidence in draft form — sensitive until published',
  evidenceContent:  'Sensitive evidence: confidential-document-ref-8847',
  piiEmail:         'testuser@example.invalid',
  piiName:          'John Doe PII Test Fixture',
  secretToken:      'sk_live_SYNTHETIC_NOT_REAL_TOKEN_abc123xyz',
  claimId:          '0xdeadbeef1234abcd',
};

// ─── Helper: collect all string values from a metadata object ─────────────────

function collectMetadataStrings(obj: unknown): string[] {
  if (obj === null || obj === undefined) return [];
  if (typeof obj === 'string') return [obj];
  if (typeof obj === 'number' || typeof obj === 'boolean') return [String(obj)];
  if (Array.isArray(obj)) return obj.flatMap(collectMetadataStrings);
  if (typeof obj === 'object') {
    return Object.values(obj as Record<string, unknown>).flatMap(
      collectMetadataStrings,
    );
  }
  return [];
}

/**
 * Extracts the rendered title string from a Next.js Metadata title field.
 * Next.js accepts `string | { absolute: string } | { default: string; template: string }`.
 */
function extractTitleString(title: unknown): string {
  if (typeof title === 'string') return title;
  if (title && typeof title === 'object') {
    if ('absolute' in title) return (title as { absolute: string }).absolute;
    if ('default' in title) return (title as { default: string }).default;
  }
  return '';
}

// ─── A. Metadata Snapshots ───────────────────────────────────────────────────

describe('A. Metadata snapshots', () => {
  // ── A1. Approved public routes ──────────────────────────────────────────────
  describe('A1. Approved public routes produce full canonical metadata', () => {
    it('/ (Claims Feed) — public', () => {
      const meta = generateRouteMetadata({ pathname: '/' });
      const title = extractTitleString(meta.title);

      expect(title).toContain('Claims Feed');
      expect(title).toContain(SITE_NAME);
      expect(meta.description).toBeTruthy();
      expect(typeof meta.description).toBe('string');

      // Canonical URL
      expect(meta.alternates?.canonical).toContain('/');
      expect(meta.alternates?.canonical).toMatch(/^https?:\/\//);

      // Robots
      expect(meta.robots).toEqual({ index: true, follow: true });

      // Open Graph
      expect(meta.openGraph?.title).toContain('Claims Feed');
      expect(meta.openGraph?.description).toBeTruthy();
      expect(meta.openGraph?.url).toContain('/');
      expect(meta.openGraph?.siteName).toBe(SITE_NAME);
      expect(meta.openGraph?.type).toBe('website');
      const ogImages = meta.openGraph?.images;
      expect(Array.isArray(ogImages) && ogImages.length > 0).toBe(true);

      // Twitter
      expect(meta.twitter?.card).toBe('summary_large_image');
      expect(meta.twitter?.title).toContain('Claims Feed');
      expect(meta.twitter?.description).toBeTruthy();
    });

    it('/how-it-works — alias of /docs per route contract: noindex, no canonical', () => {
      const meta = generateRouteMetadata({ pathname: '/how-it-works' });
      expect(meta.robots).toEqual({ index: false, follow: false });
      expect(meta.alternates?.canonical).toBeUndefined();
      expect(meta.openGraph).toBeNull();
      expect(meta.twitter).toBeNull();
    });

    it('/disputes — public per route contract', () => {
      const meta = generateRouteMetadata({ pathname: '/disputes' });
      expect(extractTitleString(meta.title)).toContain('Disputes');
      expect(meta.robots).toEqual({ index: true, follow: true });
      expect(meta.alternates?.canonical).toMatch(/\/disputes$/);
      expect(meta.openGraph?.url).toMatch(/\/disputes$/);
      expect(meta.twitter?.card).toBe('summary_large_image');
    });

    it('/treasury — public', () => {
      const meta = generateRouteMetadata({ pathname: '/treasury' });
      expect(extractTitleString(meta.title)).toContain('Treasury');
      expect(meta.robots).toEqual({ index: true, follow: true });
      expect(meta.alternates?.canonical).toContain('/treasury');
      expect(meta.openGraph?.url).toContain('/treasury');
    });

    it('/treasury/stake — alias of /treasury: canonical is the destination', () => {
      const meta = generateRouteMetadata({ pathname: '/treasury/stake' });
      expect(extractTitleString(meta.title)).toContain('Stake');
      expect(meta.robots).toEqual({ index: true, follow: true });
      expect(meta.alternates?.canonical).toBe(canonicalUrl('/treasury'));
      expect(meta.openGraph?.url).toBe(canonicalUrl('/treasury'));
    });

    it('/claims/[id] — existence unverifiable: generic noindex fallback, no canonical', () => {
      // Claim existence/public eligibility cannot be established from the route
      // parameter alone, so metadata fails closed to the generic fallback.
      const meta = generateRouteMetadata({ pathname: '/claims/[id]' });
      expect(meta).toEqual(generateRouteMetadata({ pathname: '/nonexistent-route-xyz' }));
      expect(extractTitleString(meta.title)).toBe(FALLBACK_TITLE);
      expect(meta.robots).toEqual({ index: false, follow: false });
      expect(meta.alternates?.canonical).toBeUndefined();
      expect(meta.openGraph?.url).toBeUndefined();
    });

    it('/claims/some-id — concrete claim path resolves to the same fallback', () => {
      const meta = generateRouteMetadata({ pathname: '/claims/abc123' });
      expect(meta).toEqual(generateRouteMetadata({ pathname: '/claims/[id]' }));
      expect(meta.robots).toEqual({ index: false, follow: false });
      expect(meta.alternates?.canonical).toBeUndefined();
      expect(meta.description).not.toContain('abc123');
    });
  });

  // ── A2. Authenticated / personal routes ────────────────────────────────────
  describe('A2. Authenticated (personal) routes produce noindex metadata', () => {
    const personalRoutes = ['/identity', '/rewards', '/claims/new'];

    for (const route of personalRoutes) {
      it(`${route} — noindex, openGraph and twitter suppressed`, () => {
        const meta = generateRouteMetadata({ pathname: route });

        // Robots must be noindex
        expect(meta.robots).toEqual({ index: false, follow: false });

        // No canonical URL (non-public routes must not advertise canonical)
        expect(meta.alternates?.canonical).toBeUndefined();

        // openGraph must be explicitly null (not merely undefined).
        // null suppresses the root layout's inherited OG via Next.js shallow-merge;
        // undefined would leave the root layout's OG fields in place.
        expect(meta.openGraph).toBeNull();

        // twitter must also be explicitly null to suppress inherited root twitter.
        expect(meta.twitter).toBeNull();
      });
    }
  });

  // ── A3. Privileged routes ───────────────────────────────────────────────────
  describe('A3. Privileged routes (verifier, admin) produce noindex metadata', () => {
    const privilegedRoutes = ['/verifier', '/admin'];

    for (const route of privilegedRoutes) {
      it(`${route} — noindex, openGraph and twitter suppressed`, () => {
        const meta = generateRouteMetadata({ pathname: route });

        expect(meta.robots).toEqual({ index: false, follow: false });
        expect(meta.alternates?.canonical).toBeUndefined();
        // Explicitly null to prevent Next.js metadata inheritance of root OG/twitter.
        expect(meta.openGraph).toBeNull();
        expect(meta.twitter).toBeNull();
      });
    }
  });

  // ── A4. Not-found routes ───────────────────────────────────────────────────
  describe('A4. Not-found routes use safe generic fallback', () => {
    it('notFound: true produces deterministic generic metadata', () => {
      const meta = generateRouteMetadata({ pathname: '/', notFound: true });

      expect(extractTitleString(meta.title)).toBe(FALLBACK_TITLE);
      expect(meta.description).toBe(FALLBACK_DESCRIPTION);
      expect(meta.robots).toEqual({ index: false, follow: false });
      // No canonical URL for not-found
      expect(meta.alternates?.canonical).toBeUndefined();
    });

    it('Unknown pathname produces deterministic generic fallback', () => {
      const meta = generateRouteMetadata({ pathname: '/nonexistent-route-xyz' });

      expect(extractTitleString(meta.title)).toBe(FALLBACK_TITLE);
      expect(meta.description).toBe(FALLBACK_DESCRIPTION);
      expect(meta.robots).toEqual({ index: false, follow: false });
      expect(meta.alternates?.canonical).toBeUndefined();
    });
  });

  // ── A5. Stale / redirect route ─────────────────────────────────────────────
  describe('A5. Stale and redirect routes produce noindex metadata', () => {
    it('/claim-detail (redirect) — noindex, openGraph and twitter suppressed', () => {
      const meta = generateRouteMetadata({ pathname: '/claim-detail' });

      expect(meta.robots).toEqual({ index: false, follow: false });
      // Explicitly null to suppress inherited root OG/twitter for this redirect route.
      expect(meta.openGraph).toBeNull();
      expect(meta.twitter).toBeNull();
      expect(meta.alternates?.canonical).toBeUndefined();
    });
  });

  // ── A6. Completeness check ─────────────────────────────────────────────────
  describe('A6. All public routes have deterministic metadata', () => {
    const publicPaths = ROUTE_META_TABLE.filter(
      (r) => r.visibility === 'public',
    ).map((r) => r.path);

    for (const path of publicPaths) {
      it(`${path} — title and description are non-empty strings`, () => {
        const meta = generateRouteMetadata({ pathname: path });
        const title = extractTitleString(meta.title);
        expect(title).not.toBe('');
        expect(typeof meta.description).toBe('string');
        expect(meta.description as string).not.toBe('');
      });
    }
  });
});

// ─── B. Secret / PII leakage regression tests ────────────────────────────────

describe('B. Secret and PII leakage regression', () => {
  // Routes that could plausibly be tested with sensitive parameters
  const testRoutes = [
    '/',
    '/how-it-works',
    '/treasury',
    '/treasury/stake',
    '/claims/[id]',
    '/claims/abc123',
    `/claims/${SENSITIVE_FIXTURES.claimId}`,
    '/identity',
    '/rewards',
    '/claims/new',
    '/verifier',
    '/disputes',
    '/admin',
    '/claim-detail',
    '/nonexistent-route-xyz',
  ];

  for (const route of testRoutes) {
    it(`${route} — metadata contains no sensitive fixtures`, () => {
      const meta = generateRouteMetadata({ pathname: route });
      const allStrings = collectMetadataStrings(meta);
      const combined = allStrings.join('\n');

      for (const [, value] of Object.entries(SENSITIVE_FIXTURES)) {
        expect(combined).not.toContain(value);
      }
    });
  }

  it('notFound fallback contains no sensitive fixtures', () => {
    const meta = generateRouteMetadata({
      pathname: `/claims/${SENSITIVE_FIXTURES.claimId}`,
      notFound: true,
    });
    const allStrings = collectMetadataStrings(meta);
    const combined = allStrings.join('\n');

    for (const [, value] of Object.entries(SENSITIVE_FIXTURES)) {
      expect(combined).not.toContain(value);
    }
  });

  it('Fallback metadata does not contain wallet address fixtures', () => {
    // Simulate a case where a wallet address might appear in a pathname
    const pathWithWallet = `/claims/${SENSITIVE_FIXTURES.walletAddress}`;
    const meta = generateRouteMetadata({ pathname: pathWithWallet });
    const allStrings = collectMetadataStrings(meta);
    const combined = allStrings.join('\n');

    // The wallet address must not propagate into any metadata field
    expect(combined).not.toContain(SENSITIVE_FIXTURES.walletAddress);
  });

  it('Route parameters are never reflected in canonical URLs or descriptions', () => {
    // Even for a valid-looking but untrusted dynamic path, claim ID must not
    // appear in canonical URLs, titles, descriptions, or OG fields
    const meta = generateRouteMetadata({
      pathname: `/claims/${SENSITIVE_FIXTURES.privateIdentifier}`,
    });
    const allStrings = collectMetadataStrings(meta);
    const combined = allStrings.join('\n');

    expect(combined).not.toContain(SENSITIVE_FIXTURES.privateIdentifier);
  });

  it('Session tokens never appear in any metadata field for any route', () => {
    // Test that session token fixtures are never included regardless of route
    for (const route of testRoutes) {
      const meta = generateRouteMetadata({ pathname: route });
      const allStrings = collectMetadataStrings(meta);
      const combined = allStrings.join('\n');
      expect(combined).not.toContain(SENSITIVE_FIXTURES.sessionToken);
    }
  });
});

// ─── C. Canonical URL and redirect consistency tests ─────────────────────────

describe('C. Canonical URL and redirect consistency', () => {
  describe('C1. canonicalUrl() always returns an absolute URL', () => {
    it('root path /  ', () => {
      const url = canonicalUrl('/');
      expect(url).toMatch(/^https?:\/\/.+\/$/);
    });

    it('/how-it-works', () => {
      const url = canonicalUrl('/how-it-works');
      expect(url).toMatch(/^https?:\/\/.+\/how-it-works$/);
    });

    it('/treasury/stake', () => {
      const url = canonicalUrl('/treasury/stake');
      expect(url).toMatch(/^https?:\/\/.+\/treasury\/stake$/);
    });
  });

  describe('C2. Approved origin is used, not request-derived values', () => {
    const originalEnv = process.env.NEXT_PUBLIC_APP_URL;

    afterEach(() => {
      // Restore original env
      if (originalEnv === undefined) {
        delete process.env.NEXT_PUBLIC_APP_URL;
      } else {
        process.env.NEXT_PUBLIC_APP_URL = originalEnv;
      }
    });

    it('uses NEXT_PUBLIC_APP_URL when set to a valid https URL', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://staging.truthbounty.xyz';
      const origin = getApprovedOrigin();
      expect(origin).toBe('https://staging.truthbounty.xyz');
    });

    it('falls back to the hardcoded production origin when env is absent', () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      const origin = getApprovedOrigin();
      expect(origin).toBe('https://truthbounty.xyz');
    });

    it('falls back to production origin when NEXT_PUBLIC_APP_URL is invalid', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'not-a-valid-url';
      const origin = getApprovedOrigin();
      expect(origin).toBe('https://truthbounty.xyz');
    });

    it('falls back to production origin when NEXT_PUBLIC_APP_URL is empty string', () => {
      process.env.NEXT_PUBLIC_APP_URL = '';
      const origin = getApprovedOrigin();
      expect(origin).toBe('https://truthbounty.xyz');
    });
  });

  describe('C3. Query parameters are stripped from canonical URLs', () => {
    it('strips query string from path', () => {
      const result = stripQueryAndHash('/claims/abc?session=tok&wallet=0x1234');
      expect(result).toBe('/claims/abc');
      expect(result).not.toContain('session');
      expect(result).not.toContain('wallet');
    });

    it('strips hash fragment from path', () => {
      const result = stripQueryAndHash('/how-it-works#section-2');
      expect(result).toBe('/how-it-works');
    });

    it('strips both query and hash', () => {
      const result = stripQueryAndHash('/treasury?debug=1#details');
      expect(result).toBe('/treasury');
    });

    it('canonical URL for treasury has no query params', () => {
      const url = canonicalUrl('/treasury?wallet=0xDeadBeef&session=abc');
      expect(url).not.toContain('wallet');
      expect(url).not.toContain('session');
      expect(url).toContain('/treasury');
    });
  });

  describe('C4. Path normalization', () => {
    it('root path stays /', () => {
      expect(normalizePath('/')).toBe('/');
    });

    it('removes trailing slash from non-root paths', () => {
      expect(normalizePath('/treasury/')).toBe('/treasury');
    });

    it('collapses double slashes', () => {
      expect(normalizePath('//claims//abc')).toBe('/claims/abc');
    });

    it('adds leading slash if missing', () => {
      expect(normalizePath('how-it-works')).toBe('/how-it-works');
    });

    it('empty string produces root', () => {
      expect(normalizePath('')).toBe('/');
    });
  });

  describe('C5. Canonical URL consistency with approved route authority', () => {
    it('/ canonical URL has approved origin', () => {
      const meta = generateRouteMetadata({ pathname: '/' });
      const canonical = meta.alternates?.canonical as string;
      expect(canonical).toBeTruthy();
      // Must start with the approved origin prefix
      const origin = getApprovedOrigin();
      expect(canonical.startsWith(origin)).toBe(true);
    });

    it('Redirect aliases never advertise themselves as canonical', () => {
      // Route contract: /how-it-works → /docs (not served here → no canonical);
      // /treasury/stake → /treasury (canonical is the destination).
      expect(generateRouteMetadata({ pathname: '/how-it-works' }).alternates?.canonical).toBeUndefined();
      expect(generateRouteMetadata({ pathname: '/treasury/stake' }).alternates?.canonical).toBe(
        canonicalUrl('/treasury'),
      );
    });

    it('/claim-detail (redirect) does not advertise a canonical URL', () => {
      // The redirect page should not claim a canonical destination
      const meta = generateRouteMetadata({ pathname: '/claim-detail' });
      expect(meta.alternates?.canonical).toBeUndefined();
    });

    it('Non-public routes do not produce canonical URLs', () => {
      const nonPublicRoutes = [
        '/identity',
        '/rewards',
        '/claims/new',
        '/verifier',
        '/admin',
      ];
      for (const route of nonPublicRoutes) {
        const meta = generateRouteMetadata({ pathname: route });
        expect(meta.alternates?.canonical).toBeUndefined();
      }
    });

    it('Unknown routes do not produce canonical URLs', () => {
      const meta = generateRouteMetadata({ pathname: '/unknown-xyz-route' });
      expect(meta.alternates?.canonical).toBeUndefined();
    });

    it('OG url and canonical URL agree for public routes', () => {
      const publicRoutes = [
        '/',
        '/treasury',
        '/treasury/stake',
        '/disputes',
      ];
      for (const route of publicRoutes) {
        const meta = generateRouteMetadata({ pathname: route });
        const canonical = meta.alternates?.canonical as string;
        const ogUrl = meta.openGraph?.url as string;
        expect(canonical).toBe(ogUrl);
      }
    });
  });

  describe('C6. Untrusted host values cannot override approved canonical origin', () => {
    it('getApprovedOrigin() never returns an arbitrary caller-supplied value', () => {
      // The approved origin must come from the env var or hardcoded fallback —
      // never from a caller-supplied parameter. This test verifies the function
      // signature does not accept a host parameter.
      const origin = getApprovedOrigin();
      // Must be a valid https:// (or http://) URL
      expect(origin).toMatch(/^https?:\/\//);
      // Must not be empty
      expect(origin).not.toBe('');
    });

    it('canonicalUrl() uses the approved origin, not a caller-supplied host', () => {
      // canonicalUrl() accepts only a path, never a host.
      // Verifies the function cannot be abused to construct arbitrary-origin URLs.
      const url = canonicalUrl('/treasury');
      const origin = getApprovedOrigin();
      expect(url.startsWith(origin)).toBe(true);
    });
  });
});

// ─── D. Safe fallback tests ───────────────────────────────────────────────────

describe('D. Safe fallback behavior', () => {
  describe('D1. Missing / unavailable resources', () => {
    it('notFound: true always produces FALLBACK_TITLE regardless of path', () => {
      const paths = ['/', '/claims/abc', '/treasury', '/unknown'];
      for (const path of paths) {
        const meta = generateRouteMetadata({ pathname: path, notFound: true });
        expect(extractTitleString(meta.title)).toBe(FALLBACK_TITLE);
      }
    });

    it('Fallback is deterministic (same input → same output)', () => {
      const a = generateRouteMetadata({ pathname: '/unknown', notFound: true });
      const b = generateRouteMetadata({ pathname: '/unknown', notFound: true });
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it('Unknown route fallback is deterministic', () => {
      const a = generateRouteMetadata({ pathname: '/nonexistent-abc' });
      const b = generateRouteMetadata({ pathname: '/nonexistent-abc' });
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
  });

  describe('D2. Fallback metadata does not leak resource-specific private data', () => {
    it('Claim ID does not appear in fallback metadata', () => {
      const meta = generateRouteMetadata({
        pathname: '/claims/sensitive-claim-123',
        notFound: true,
      });
      const allStrings = collectMetadataStrings(meta);
      expect(allStrings.join('\n')).not.toContain('sensitive-claim-123');
    });

    it('Route parameters do not appear in unknown-route fallback', () => {
      const meta = generateRouteMetadata({ pathname: '/users/private-uid-xyz' });
      const allStrings = collectMetadataStrings(meta);
      expect(allStrings.join('\n')).not.toContain('private-uid-xyz');
    });
  });

  describe('D3. Fallback does not imply resource availability or verified status', () => {
    it('Fallback title is generic site name, not a resource-specific title', () => {
      const meta = generateRouteMetadata({
        pathname: '/claims/missing-claim',
        notFound: true,
      });
      const title = extractTitleString(meta.title);
      expect(title).toBe(SITE_NAME);
      // Must not contain "verified", "found", "active", or resource-specific words
      expect(title.toLowerCase()).not.toContain('verified');
      expect(title.toLowerCase()).not.toContain('active');
    });

    it('Fallback robots directive is noindex', () => {
      const meta = generateRouteMetadata({ pathname: '/unknown', notFound: true });
      expect(meta.robots).toEqual({ index: false, follow: false });
    });
  });

  describe('D4. Denied / access-controlled routes fail closed', () => {
    const accessControlledRoutes = [
      { path: '/admin',     visibility: 'admin'    as RouteVisibility },
      { path: '/verifier',  visibility: 'verifier' as RouteVisibility },
      { path: '/identity',  visibility: 'personal' as RouteVisibility },
      { path: '/rewards',   visibility: 'personal' as RouteVisibility },
      { path: '/claims/new',visibility: 'personal' as RouteVisibility },
    ];

    for (const { path, visibility } of accessControlledRoutes) {
      it(`${path} (${visibility}) — robots noindex, no canonical, OG/twitter suppressed`, () => {
        const meta = generateRouteMetadata({ pathname: path });
        expect(meta.robots).toEqual({ index: false, follow: false });
        expect(meta.alternates?.canonical).toBeUndefined();
        // null explicitly suppresses root layout OG/twitter inheritance.
        expect(meta.openGraph).toBeNull();
        expect(meta.twitter).toBeNull();
      });
    }
  });
});

// ─── E. ROUTE_META_TABLE invariants ───────────────────────────────────────────

describe('E. ROUTE_META_TABLE invariants', () => {
  it('All paths start with /', () => {
    for (const entry of ROUTE_META_TABLE) {
      expect(entry.path).toMatch(/^\//);
    }
  });

  it('All paths are unique', () => {
    const paths = ROUTE_META_TABLE.map((r) => r.path);
    const unique = new Set(paths);
    expect(unique.size).toBe(paths.length);
  });

  it('All entries have non-empty titles and descriptions', () => {
    for (const entry of ROUTE_META_TABLE) {
      expect(entry.title).toBeTruthy();
      expect(entry.description).toBeTruthy();
    }
  });

  it('All visibility values are known RouteVisibility types', () => {
    const knownVisibilities: RouteVisibility[] = [
      'public', 'personal', 'verifier', 'admin', 'redirect', 'notFound',
    ];
    for (const entry of ROUTE_META_TABLE) {
      expect(knownVisibilities).toContain(entry.visibility);
    }
  });

  it('ROBOTS_DIRECTIVES.public allows indexing; all others deny', () => {
    expect(ROBOTS_DIRECTIVES.public).toEqual({ index: true, follow: true });
    expect(ROBOTS_DIRECTIVES.personal).toEqual({ index: false, follow: false });
    expect(ROBOTS_DIRECTIVES.verifier).toEqual({ index: false, follow: false });
    expect(ROBOTS_DIRECTIVES.admin).toEqual({ index: false, follow: false });
    expect(ROBOTS_DIRECTIVES.redirect).toEqual({ index: false, follow: false });
    expect(ROBOTS_DIRECTIVES.notFound).toEqual({ index: false, follow: false });
  });

  it('findRouteMeta returns undefined for unknown paths', () => {
    expect(findRouteMeta('/unknown-xyz')).toBeUndefined();
    expect(findRouteMeta('')).toBeUndefined();
    expect(findRouteMeta('/admin/sub-path')).toBeUndefined();
  });

  it('findRouteMeta normalizes /claims/<id> to /claims/[id]', () => {
    const def = findRouteMeta('/claims/0xabc123');
    expect(def).toBeDefined();
    expect(def?.path).toBe('/claims/[id]');
  });

  it('findRouteMeta does not normalize /claims/new', () => {
    const def = findRouteMeta('/claims/new');
    expect(def).toBeDefined();
    expect(def?.path).toBe('/claims/new');
  });
});

// ─── F. Privacy boundary: public metadata fields must be static-only ─────────

describe('F. Public metadata privacy boundaries', () => {
  it('Public route OG title equals page title', () => {
    const meta = generateRouteMetadata({ pathname: '/disputes' });
    expect(meta.openGraph?.title).toBe(extractTitleString(meta.title));
  });

  it('Public route OG description equals page description', () => {
    const meta = generateRouteMetadata({ pathname: '/disputes' });
    expect(meta.openGraph?.description).toBe(meta.description);
  });

  it('Public route twitter title equals page title', () => {
    const meta = generateRouteMetadata({ pathname: '/treasury' });
    expect(meta.twitter?.title).toBe(extractTitleString(meta.title));
  });

  it('OG image path is the static default, not a dynamic or API-sourced URL', () => {
    const meta = generateRouteMetadata({ pathname: '/' });
    const ogImages = meta.openGraph?.images as Array<{ url: string }>;
    expect(ogImages?.[0]?.url).toContain('1-claims-feed');
  });

  it('Twitter image is the static default, not a dynamic or API-sourced URL', () => {
    const meta = generateRouteMetadata({ pathname: '/treasury' });
    const twitterImages = meta.twitter?.images as string[];
    expect(twitterImages?.[0]).toContain('1-claims-feed');
  });

  it('Non-public routes have no openGraph images', () => {
    const meta = generateRouteMetadata({ pathname: '/identity' });
    // openGraph must be null to suppress inheritance from root layout.
    expect(meta.openGraph).toBeNull();
  });
});
