import {
  NONCE_HEADER,
  SECURITY_HEADER_NAMES,
  CACHE_CONTROL_POLICIES,
  PERMISSIONS_POLICY,
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  buildStaticSecurityHeaders,
  buildApiSecurityHeaders,
  createRequestNonce,
} from '@/lib/security/headers';

describe('V2-FE-131 & UI-FE-092 security headers', () => {
  const nonce = 'test-nonce-abc123';

  describe('buildContentSecurityPolicy', () => {
    it('requires a nonce (fail closed)', () => {
      expect(() => buildContentSecurityPolicy({ nonce: '' })).toThrow(/nonce/i);
    });

    it('emits enforcing CSP with nonce, strict-dynamic, and deny framing', () => {
      const csp = buildContentSecurityPolicy({ nonce });
      expect(csp).toContain(`'nonce-${nonce}'`);
      expect(csp).toContain("'strict-dynamic'");
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain('upgrade-insecure-requests');
      expect(csp).toContain('wss://relay.walletconnect.com');
      expect(csp).toContain('https://id.worldcoin.org');
      expect(csp).not.toContain("'unsafe-eval'");
    });

    it('allows unsafe-eval only in development for Next HMR', () => {
      const csp = buildContentSecurityPolicy({ nonce, isDevelopment: true });
      expect(csp).toContain("'unsafe-eval'");
      expect(csp).toContain('http://localhost:*');
    });

    it('scopes RPC origins based on target environment', () => {
      const testnetCsp = buildContentSecurityPolicy({ nonce, environment: 'testnet' });
      expect(testnetCsp).toContain('https://sepolia.optimism.io');
      expect(testnetCsp).not.toContain("'unsafe-eval'");

      const prodCsp = buildContentSecurityPolicy({ nonce, environment: 'production' });
      expect(prodCsp).toContain('https://mainnet.optimism.io');
      expect(prodCsp).not.toContain("'unsafe-eval'");
    });
  });

  describe('buildSecurityHeaders', () => {
    it('sets CSP plus baseline browser hardening and anti-caching headers', () => {
      const headers = buildSecurityHeaders({ nonce });
      expect(headers[SECURITY_HEADER_NAMES.contentSecurityPolicy]).toContain(
        `'nonce-${nonce}'`,
      );
      expect(headers[SECURITY_HEADER_NAMES.contentSecurityPolicyReportOnly]).toBeUndefined();
      expect(headers[SECURITY_HEADER_NAMES.strictTransportSecurity]).toContain('max-age=');
      expect(headers[SECURITY_HEADER_NAMES.xContentTypeOptions]).toBe('nosniff');
      expect(headers[SECURITY_HEADER_NAMES.xFrameOptions]).toBe('DENY');
      expect(headers[SECURITY_HEADER_NAMES.referrerPolicy]).toBe(
        'strict-origin-when-cross-origin',
      );
      expect(headers[SECURITY_HEADER_NAMES.crossOriginOpenerPolicy]).toBe(
        'same-origin-allow-popups',
      );
      expect(headers[SECURITY_HEADER_NAMES.permissionsPolicy]).toContain('camera=');
      expect(headers[SECURITY_HEADER_NAMES.permissionsPolicy]).toContain('microphone=()');
      expect(headers[SECURITY_HEADER_NAMES.permissionsPolicy]).toContain('geolocation=()');
      expect(headers[SECURITY_HEADER_NAMES.permissionsPolicy]).toContain('payment=()');
      expect(headers[SECURITY_HEADER_NAMES.permissionsPolicy]).toContain('usb=()');
      expect(headers[SECURITY_HEADER_NAMES.permissionsPolicy]).toContain('display-capture=()');
      expect(headers[SECURITY_HEADER_NAMES.cacheControl]).toBe(CACHE_CONTROL_POLICIES.dynamicHtml);
      expect(headers[SECURITY_HEADER_NAMES.pragma]).toBe('no-cache');
    });

    it('can emit report-only CSP for staged rollout', () => {
      const headers = buildSecurityHeaders({ nonce, reportOnly: true });
      expect(headers[SECURITY_HEADER_NAMES.contentSecurityPolicy]).toBeUndefined();
      expect(headers[SECURITY_HEADER_NAMES.contentSecurityPolicyReportOnly]).toContain(
        `'nonce-${nonce}'`,
      );
    });
  });

  describe('buildStaticSecurityHeaders & buildApiSecurityHeaders', () => {
    it('omits CSP (nonce-bound) but keeps static hardening headers', () => {
      const headers = buildStaticSecurityHeaders();
      expect(headers[SECURITY_HEADER_NAMES.contentSecurityPolicy]).toBeUndefined();
      expect(headers[SECURITY_HEADER_NAMES.xContentTypeOptions]).toBe('nosniff');
      expect(headers[SECURITY_HEADER_NAMES.xFrameOptions]).toBe('DENY');
      expect(headers[SECURITY_HEADER_NAMES.referrerPolicy]).toBe('strict-origin-when-cross-origin');
    });

    it('buildApiSecurityHeaders enforces anti-caching boundaries on API routes', () => {
      const headers = buildApiSecurityHeaders();
      expect(headers[SECURITY_HEADER_NAMES.cacheControl]).toBe(CACHE_CONTROL_POLICIES.api);
      expect(headers[SECURITY_HEADER_NAMES.pragma]).toBe('no-cache');
      expect(headers[SECURITY_HEADER_NAMES.xFrameOptions]).toBe('DENY');
      expect(headers[SECURITY_HEADER_NAMES.xContentTypeOptions]).toBe('nosniff');
    });
  });

  describe('createRequestNonce / NONCE_HEADER', () => {
    it('produces a non-empty nonce suitable for CSP', () => {
      const a = createRequestNonce();
      const b = createRequestNonce();
      expect(a.length).toBeGreaterThan(8);
      expect(b.length).toBeGreaterThan(8);
      expect(a).not.toEqual(b);
      expect(NONCE_HEADER).toBe('x-nonce');
    });
  });
});
