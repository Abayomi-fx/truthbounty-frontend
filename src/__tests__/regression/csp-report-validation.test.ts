jest.mock('next/server', () => ({
  NextResponse: class {
    status: number;

    constructor(_body: unknown, init?: { status?: number }) {
      this.status = init?.status ?? 200;
    }
  },
}));

import { POST } from '@/app/api/csp-report/route';

describe('CSP report validation', () => {
  const createRequest = (payload: unknown) => {
    const body = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const bytes = encoder.encode(body);
    let consumed = false;

    return {
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-length'
            ? String(bytes.byteLength)
            : null,
      },
      body: {
        getReader: () => ({
          read: async () => {
            if (consumed) {
              return { done: true, value: undefined };
            }

            consumed = true;
            return { done: false, value: bytes };
          },
          cancel: async () => undefined,
          releaseLock: () => undefined,
        }),
      },
    } as unknown as Request;
  };

  it('rejects an empty legacy report', async () => {
    const response = await POST(
      createRequest({
        'csp-report': {},
      }),
    );

    expect(response.status).toBe(400);
  });

  it('rejects an empty Reporting API report', async () => {
    const response = await POST(createRequest([{}]));

    expect(response.status).toBe(400);
  });

  it('accepts a valid legacy CSP report', async () => {
    const response = await POST(
      createRequest({
        'csp-report': {
          'effective-directive': 'script-src',
          'blocked-uri': 'https://example.com/script.js',
          'document-uri': 'https://example.com/',
        },
      }),
    );

    expect(response.status).toBe(204);
  });

  it('accepts a valid Reporting API CSP report', async () => {
    const response = await POST(
      createRequest([
        {
          body: {
            effectiveDirective: 'script-src',
            blockedURL: 'https://example.com/script.js',
            documentURL: 'https://example.com/',
          },
        },
      ]),
    );

    expect(response.status).toBe(204);
  });
});