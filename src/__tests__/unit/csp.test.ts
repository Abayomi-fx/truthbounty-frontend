import {
  buildContentSecurityPolicy,
  createRequestNonce,
} from '@/lib/security/headers';

describe('CSP', () => {
  const nonce = 'test-nonce-abc123';

  describe('createRequestNonce', () => {
    it('returns a non-empty base64-like string', () => {
      const value = createRequestNonce();

      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    });

    it('returns a unique value on each call', () => {
      expect(createRequestNonce()).not.toBe(createRequestNonce());
    });
  });

  describe('buildContentSecurityPolicy', () => {
    it('includes the nonce in script-src', () => {
      expect(buildContentSecurityPolicy({ nonce })).toContain(
        `'nonce-${nonce}'`,
      );
    });

    it('does not include unsafe-inline in script-src', () => {
      const scriptSrc = buildContentSecurityPolicy({ nonce })
        .split(';')
        .map((directive) => directive.trim())
        .find((directive) => directive.startsWith('script-src'));

      expect(scriptSrc).toBeDefined();
      expect(scriptSrc).not.toContain("'unsafe-inline'");
    });

    it('does not include unsafe-eval in production', () => {
      expect(
        buildContentSecurityPolicy({
          nonce,
          isDevelopment: false,
        }),
      ).not.toContain("'unsafe-eval'");
    });

    it('blocks framing via frame-ancestors none', () => {
      expect(buildContentSecurityPolicy({ nonce })).toContain(
        "frame-ancestors 'none'",
      );
    });

    it('allows Worldcoin IDKit iframe in frame-src', () => {
      const frameSrc = buildContentSecurityPolicy({ nonce })
        .split(';')
        .map((directive) => directive.trim())
        .find((directive) => directive.startsWith('frame-src'));

      expect(frameSrc).toContain('https://id.worldcoin.org');
    });

    it('includes WalletConnect relay origins in connect-src', () => {
      const connectSrc = buildContentSecurityPolicy({ nonce })
        .split(';')
        .map((directive) => directive.trim())
        .find((directive) => directive.startsWith('connect-src'));

      expect(connectSrc).toContain('wss://*.walletconnect.org');
      expect(connectSrc).toContain('https://*.walletconnect.com');
    });

    it('includes Optimism public RPC fallbacks in connect-src', () => {
      const connectSrc = buildContentSecurityPolicy({ nonce })
        .split(';')
        .map((directive) => directive.trim())
        .find((directive) => directive.startsWith('connect-src'));

      expect(connectSrc).toContain('https://mainnet.optimism.io');
      expect(connectSrc).toContain('https://sepolia.optimism.io');
    });

    it('includes upgrade-insecure-requests in production', () => {
      expect(
        buildContentSecurityPolicy({
          nonce,
          isDevelopment: false,
        }),
      ).toContain('upgrade-insecure-requests');
    });

    it('does not include upgrade-insecure-requests in development', () => {
      expect(
        buildContentSecurityPolicy({
          nonce,
          isDevelopment: true,
        }),
      ).not.toContain('upgrade-insecure-requests');
    });

    it('sets object-src to none', () => {
      expect(buildContentSecurityPolicy({ nonce })).toContain(
        "object-src 'none'",
      );
    });

    it('restricts base-uri to self', () => {
      expect(buildContentSecurityPolicy({ nonce })).toContain(
        "base-uri 'self'",
      );
    });
  });
});
