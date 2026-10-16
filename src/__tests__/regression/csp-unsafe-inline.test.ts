/**
 * Regression: 'unsafe-inline' must never appear in script-src in any
 * environment. This protects against accidental reintroduction of inline
 * execution.
 */
import {
  buildContentSecurityPolicy,
  createRequestNonce,
} from '@/lib/security/headers';

const capturedRequests: Array<{
  headers: Headers;
}> = [];

jest.mock('next/server', () => ({
  NextRequest: class {
    headers: Headers;

    constructor(
      _request: { headers: Headers },
      options: { headers: Headers },
    ) {
      this.headers = options.headers;
    }
  },
  NextResponse: {
    next: () => ({
      headers: new Headers(),
    }),
  },
}));

jest.mock('next-intl/middleware', () => ({
  __esModule: true,
  default: () => (request: { headers: Headers }) => {
    capturedRequests.push(request);
    return {
      headers: new Headers(),
    };
  },
}));

describe('CSP regression — no unsafe-inline in script-src', () => {
  const envScenarios = [
    {
      label: 'production',
      isDevelopment: false,
    },
    {
      label: 'development',
      isDevelopment: true,
    },
  ];

  for (const { label, isDevelopment } of envScenarios) {
    it(`script-src never contains 'unsafe-inline' — ${label}`, () => {
      const csp = buildContentSecurityPolicy({
        nonce: createRequestNonce(),
        isDevelopment,
      });

      const scriptSrc = csp
        .split(';')
        .map((directive) => directive.trim())
        .find((directive) => directive.startsWith('script-src'));

      expect(scriptSrc).toBeDefined();
      expect(scriptSrc).not.toContain("'unsafe-inline'");
    });
  }

  it('nonce rotates between requests so one compromised nonce cannot be reused', () => {
    const nonces = new Set(
      Array.from({ length: 50 }, () => createRequestNonce()),
    );

    expect(nonces.size).toBe(50);
  });

  it('forwards a fresh nonce to Next.js and applies the matching CSP to each response', async () => {
    capturedRequests.length = 0;

    const { default: middleware } = await import('../../../middleware');

    const createRequest = () => ({
      headers: new Headers(),
    });

    const firstResponse = middleware(createRequest() as unknown as import('next/server').NextRequest);
    const secondResponse = middleware(createRequest() as unknown as import('next/server').NextRequest);

    const firstRequestNonce =
      capturedRequests[0]?.headers.get('x-nonce');
    const secondRequestNonce =
      capturedRequests[1]?.headers.get('x-nonce');

    expect(firstRequestNonce).toBeTruthy();
    expect(secondRequestNonce).toBeTruthy();
    expect(firstRequestNonce).not.toBe(secondRequestNonce);

    const firstRequestCsp =
      capturedRequests[0]?.headers.get('Content-Security-Policy');
    const secondRequestCsp =
      capturedRequests[1]?.headers.get('Content-Security-Policy');

    expect(firstRequestCsp).toContain(`'nonce-${firstRequestNonce}'`);
    expect(secondRequestCsp).toContain(`'nonce-${secondRequestNonce}'`);

    expect(firstResponse.headers.get('Content-Security-Policy')).toContain(
      `'nonce-${firstRequestNonce}'`,
    );
    expect(secondResponse.headers.get('Content-Security-Policy')).toContain(
      `'nonce-${secondRequestNonce}'`,
    );
  });
});