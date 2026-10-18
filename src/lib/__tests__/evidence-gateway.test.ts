import { describe, expect, it, jest } from '@jest/globals';
/**
 * UI-FE-073 — IPFS gateway integrity and bounded failover tests.
 *
 * Covers primary outage, failover, content mismatch, stale cache, rate limit,
 * malicious redirects, CID/integrity metadata, bounds, cache safety, and
 * cross-gateway byte equivalence.
 */

import { createHash } from 'node:crypto';
import { TextEncoder } from 'node:util';
import {
  DEFAULT_IPFS_GATEWAY_POLICY,
  EvidenceGatewayResolver,
  buildApprovedGatewayUrl,
  parseCid,
  parseIpfsEvidenceUri,
  type EvidenceGatewayResolverDeps,
} from '../evidence-gateway';

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

function sha256Digest(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(bytes).digest());
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function varint(value: number): number[] {
  const bytes: number[] = [];
  let remaining = value;
  while (remaining >= 0x80) {
    bytes.push((remaining & 0x7f) | 0x80);
    remaining >>>= 7;
  }
  bytes.push(remaining);
  return bytes;
}

function base58Encode(bytes: Uint8Array): string {
  let number = 0n;
  for (const byte of bytes) {
    number = number * 256n + BigInt(byte);
  }
  let output = '';
  while (number > 0n) {
    output = BASE58_ALPHABET[Number(number % 58n)] + output;
    number /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    output = `1${output}`;
  }
  return output || '1';
}

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let buffer = 0;
  let output = '';

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += BASE32_ALPHABET[(buffer >> bits) & 31];
      buffer &= (1 << bits) - 1;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
  }
  return output;
}

function cidV0(bytes: Uint8Array): string {
  const digest = sha256Digest(bytes);
  return base58Encode(Uint8Array.from([0x12, 0x20, ...digest]));
}

function cidV1(bytes: Uint8Array, hashCode = 0x12): string {
  const digest = sha256Digest(bytes);
  const multihash =
    hashCode === 0x12
      ? [0x12, 0x20, ...digest]
      : [...varint(hashCode), 0x20, ...digest];
  return `b${base32Encode(Uint8Array.from([0x01, 0x55, ...multihash]))}`;
}

function fakeResponse(
  body: Uint8Array,
  options: {
    status?: number;
    contentType?: string;
    headers?: Record<string, string>;
  } = {},
): Response {
  const headers = new Map(
    Object.entries(options.headers ?? {}).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ]),
  );
  if (options.contentType) headers.set('content-type', options.contentType);

  return {
    status: options.status ?? 200,
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) ?? null,
    },
    arrayBuffer: async () =>
      body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  } as unknown as Response;
}

function resolver(
  fetchImpl: typeof fetch,
  overrides: Partial<EvidenceGatewayResolverDeps> = {},
): EvidenceGatewayResolver {
  return new EvidenceGatewayResolver({
    fetchImpl,
    sha256Hex: async (bytes) => sha256Hex(bytes),
    now: () => 1_000,
    policy: {
      requestTimeoutMs: 50,
      cacheTtlMs: 60_000,
      ...overrides.policy,
    },
    ...overrides,
  });
}

const EVIDENCE_BYTES = new TextEncoder().encode(
  '{"evidence":"canonical bytes","version":1}',
);
const CID_V0 = cidV0(EVIDENCE_BYTES);
const CID_V1 = cidV1(EVIDENCE_BYTES);

describe('CID and evidence identity parsing', () => {
  it('parses CIDv0 and CIDv1 and never treats the gateway URL as identity', () => {
    expect(parseCid(CID_V0)?.version).toBe(0);
    expect(parseCid(CID_V1)?.version).toBe(1);

    const fromIpfs = parseIpfsEvidenceUri(`ipfs://${CID_V0}/evidence.json`);
    const fromGateway = parseIpfsEvidenceUri(
      `https://dweb.link/ipfs/${CID_V0}/evidence.json`,
    );
    const fromAlternativeGateway = parseIpfsEvidenceUri(
      `https://ipfs.io/ipfs/${CID_V0}/evidence.json`,
    );

    expect(fromIpfs?.identity).toBe(`ipfs://${CID_V0}/evidence.json`);
    expect(fromGateway?.identity).toBe(fromIpfs?.identity);
    expect(fromAlternativeGateway?.identity).toBe(fromIpfs?.identity);
    expect(fromGateway?.cid).toBe(CID_V0);
  });

  it('rejects unapproved gateways, malformed CIDs, and path traversal', () => {
    expect(
      parseIpfsEvidenceUri(`https://evil.example/ipfs/${CID_V0}`),
    ).toBeNull();
    expect(parseIpfsEvidenceUri(`https://dweb.link/not-ipfs/${CID_V0}`)).toBeNull();
    expect(parseIpfsEvidenceUri('ipfs://not-a-cid/file')).toBeNull();
    expect(parseIpfsEvidenceUri(`ipfs://${CID_V0}/../secret`)).toBeNull();
    expect(parseIpfsEvidenceUri(`ipfs://${CID_V0}/%2e%2e/secret`)).toBeNull();
  });

  it('builds gateway URLs through the approved policy only', () => {
    expect(
      buildApprovedGatewayUrl(
        DEFAULT_IPFS_GATEWAY_POLICY.gateways[0],
        CID_V0,
        '/evidence.json',
      ),
    ).toBe(`https://dweb.link/ipfs/${CID_V0}/evidence.json`);
  });
});

describe('gateway integrity and failover', () => {
  it('verifies bytes against the CID on the primary gateway', async () => {
    const fetchImpl = jest.fn(async () => fakeResponse(EVIDENCE_BYTES));
    const result = await resolver(fetchImpl as unknown as typeof fetch).resolve({
      uri: `ipfs://${CID_V0}/evidence.json`,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cid).toBe(CID_V0);
    expect(result.identity).toBe(`ipfs://${CID_V0}/evidence.json`);
    expect(result.gatewayId).toBe('dweb-link');
    expect(result.verifiedBy).toBe('cid');
    expect(result.bytes).toEqual(EVIDENCE_BYTES);
    expect(result.attempts).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fails over to the next approved gateway on primary outage', async () => {
    const fetchImpl = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(fakeResponse(new Uint8Array(), { status: 503 }))
      .mockResolvedValueOnce(fakeResponse(EVIDENCE_BYTES));

    const result = await resolver(fetchImpl as unknown as typeof fetch).resolve({
      uri: `ipfs://${CID_V0}`,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.gatewayId).toBe('ipfs-io');
    expect(result.attempts.map((attempt) => attempt.gatewayId)).toEqual([
      'dweb-link',
      'ipfs-io',
    ]);
    expect(result.attempts[0]).toMatchObject({
      outcome: 'failed',
      status: 503,
      reason: 'server-error',
      kind: 'unavailable',
    });
  });

  it('reports unavailable when every approved gateway fails', async () => {
    const fetchImpl = jest.fn(async () =>
      fakeResponse(new Uint8Array(), { status: 503 }),
    );
    const result = await resolver(fetchImpl as unknown as typeof fetch).resolve({
      uri: `ipfs://${CID_V0}`,
    });

    expect(result).toMatchObject({
      ok: false,
      kind: 'unavailable',
      reason: 'server-error',
      cid: CID_V0,
    });
    expect(result.attempts).toHaveLength(2);
  });

  it('honours the bounded attempt limit', async () => {
    const fetchImpl = jest.fn(async () =>
      fakeResponse(new Uint8Array(), { status: 503 }),
    );
    const result = await resolver(fetchImpl as unknown as typeof fetch, {
      policy: { maxAttempts: 1 },
    }).resolve({ uri: `ipfs://${CID_V0}` });

    expect(result.ok).toBe(false);
    expect(result.attempts).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fails over on rate limiting and reports it when all are limited', async () => {
    const successAfterRateLimit = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(fakeResponse(new Uint8Array(), { status: 429 }))
      .mockResolvedValueOnce(fakeResponse(EVIDENCE_BYTES));
    const success = await resolver(
      successAfterRateLimit as unknown as typeof fetch,
    ).resolve({ uri: `ipfs://${CID_V0}` });
    expect(success.ok).toBe(true);
    expect(success.attempts[0].reason).toBe('rate-limited');

    const allLimited = jest.fn(async () =>
      fakeResponse(new Uint8Array(), { status: 429 }),
    );
    const failure = await resolver(
      allLimited as unknown as typeof fetch,
    ).resolve({ uri: `ipfs://${CID_V0}` });
    expect(failure).toMatchObject({
      ok: false,
      kind: 'unavailable',
      reason: 'rate-limited',
    });
  });

  it('blocks rendering on an integrity mismatch', async () => {
    const wrongBytes = new TextEncoder().encode('tampered content');
    const fetchImpl = jest.fn(async () => fakeResponse(wrongBytes));

    const result = await resolver(fetchImpl as unknown as typeof fetch).resolve({
      uri: `ipfs://${CID_V0}`,
    });

    expect(result).toMatchObject({
      ok: false,
      kind: 'mismatch',
      reason: 'integrity-mismatch',
      cid: CID_V0,
    });
    expect('bytes' in result).toBe(false);
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]).toMatchObject({
      reason: 'integrity-mismatch',
      kind: 'mismatch',
    });
  });

  it('blocks rendering when integrity metadata mismatches the CID', async () => {
    const fetchImpl = jest.fn(async () => fakeResponse(EVIDENCE_BYTES));
    const wrongSha = sha256Hex(new TextEncoder().encode('other'));

    const result = await resolver(fetchImpl as unknown as typeof fetch).resolve({
      uri: `ipfs://${CID_V0}`,
      integrity: { sha256: `sha256:${wrongSha}` },
    });

    expect(result).toMatchObject({
      ok: false,
      kind: 'mismatch',
      reason: 'integrity-mismatch',
    });
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('rejects metadata that names a different canonical CID', async () => {
    const fetchImpl = jest.fn(async () => fakeResponse(EVIDENCE_BYTES));
    const result = await resolver(fetchImpl as unknown as typeof fetch).resolve({
      uri: `ipfs://${CID_V0}`,
      integrity: { cid: CID_V1 },
    });

    expect(result).toMatchObject({
      ok: false,
      kind: 'mismatch',
      reason: 'cid-mismatch',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('quarantines content that cannot be verified', async () => {
    const unsupported = cidV1(EVIDENCE_BYTES, 0xb220);
    const fetchImpl = jest.fn(async () => fakeResponse(EVIDENCE_BYTES));

    const missingMetadata = await resolver(
      fetchImpl as unknown as typeof fetch,
    ).resolve({ uri: `ipfs://${unsupported}` });
    expect(missingMetadata).toMatchObject({
      ok: false,
      kind: 'quarantined',
      reason: 'unsupported-hash',
    });
    expect(fetchImpl).not.toHaveBeenCalled();

    const withSha = await resolver(
      fetchImpl as unknown as typeof fetch,
    ).resolve({
      uri: `ipfs://${unsupported}`,
      integrity: { sha256: sha256Hex(EVIDENCE_BYTES) },
    });
    expect(withSha.ok).toBe(true);
    if (withSha.ok) expect(withSha.verifiedBy).toBe('sha256');
  });

  it('quarantines oversized responses', async () => {
    const fetchImpl = jest.fn(async () =>
      fakeResponse(EVIDENCE_BYTES, {
        headers: { 'content-length': String(EVIDENCE_BYTES.byteLength + 1) },
      }),
    );
    const result = await resolver(fetchImpl as unknown as typeof fetch, {
      policy: { maxBytes: EVIDENCE_BYTES.byteLength },
    }).resolve({ uri: `ipfs://${CID_V0}` });

    expect(result).toMatchObject({
      ok: false,
      kind: 'quarantined',
      reason: 'oversized',
    });
  });

  it('rejects malicious cross-origin redirects', async () => {
    const fetchImpl = jest.fn(async () =>
      fakeResponse(new Uint8Array(), {
        status: 302,
        headers: { location: 'https://evil.example/steal' },
      }),
    );
    const result = await resolver(fetchImpl as unknown as typeof fetch, {
      policy: { maxAttempts: 1 },
    }).resolve({ uri: `ipfs://${CID_V0}` });

    expect(result).toMatchObject({
      ok: false,
      kind: 'provider-failure',
      reason: 'malicious-redirect',
    });
    expect(result.attempts[0]).toMatchObject({
      status: 302,
      reason: 'malicious-redirect',
    });
  });

  it('follows same-origin redirects within the approved gateway', async () => {
    const fetchImpl = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        fakeResponse(new Uint8Array(), {
          status: 302,
          headers: { location: `/ipfs/${CID_V0}/redirected` },
        }),
      )
      .mockResolvedValueOnce(fakeResponse(EVIDENCE_BYTES));

    const result = await resolver(fetchImpl as unknown as typeof fetch).resolve({
      uri: `ipfs://${CID_V0}`,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.attempts[0].redirects).toBe(1);
  });
});

describe('cache safety and cross-gateway equivalence', () => {
  it('serves a fresh verified cache entry without refetching', async () => {
    const fetchImpl = jest.fn(async () => fakeResponse(EVIDENCE_BYTES));
    const gateway = resolver(fetchImpl as unknown as typeof fetch, {
      now: () => 1_000,
      policy: { cacheTtlMs: 100 },
    });

    const first = await gateway.resolve({ uri: `ipfs://${CID_V0}` });
    expect(first.ok).toBe(true);

    const cached = await gateway.resolve({ uri: `ipfs://${CID_V0}` });
    expect(cached.ok).toBe(true);
    if (cached.ok) expect(cached.fromCache).toBe(true);
    expect(gateway.cacheSize).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('never serves a stale cache entry when the gateways are down', async () => {
    let now = 1_000;
    let fail = false;
    const fetchImpl = jest.fn(async () =>
      fail
        ? fakeResponse(new Uint8Array(), { status: 503 })
        : fakeResponse(EVIDENCE_BYTES),
    );
    const gateway = resolver(fetchImpl as unknown as typeof fetch, {
      now: () => now,
      policy: { cacheTtlMs: 100 },
    });

    const primed = await gateway.resolve({ uri: `ipfs://${CID_V0}` });
    expect(primed.ok).toBe(true);
    expect(gateway.cacheSize).toBe(1);

    fail = true;
    now = 5_000;
    const stale = await gateway.resolve({ uri: `ipfs://${CID_V0}` });

    expect(stale).toMatchObject({
      ok: false,
      kind: 'quarantined',
      reason: 'stale-cache',
    });
    expect('bytes' in stale).toBe(false);
  });

  it('produces byte-equivalent results across approved gateways', async () => {
    const fetchImpl = jest.fn(async () => fakeResponse(EVIDENCE_BYTES));
    const dwebPolicy = {
      gateways: [DEFAULT_IPFS_GATEWAY_POLICY.gateways[0]],
    };
    const ipfsPolicy = {
      gateways: [DEFAULT_IPFS_GATEWAY_POLICY.gateways[1]],
    };

    const fromDweb = await resolver(fetchImpl as unknown as typeof fetch, {
      policy: dwebPolicy,
    }).resolve({ uri: `ipfs://${CID_V0}/evidence.json` });
    const fromIpfs = await resolver(fetchImpl as unknown as typeof fetch, {
      policy: ipfsPolicy,
    }).resolve({ uri: `ipfs://${CID_V0}/evidence.json` });

    expect(fromDweb.ok).toBe(true);
    expect(fromIpfs.ok).toBe(true);
    if (!fromDweb.ok || !fromIpfs.ok) return;
    expect(fromDweb.identity).toBe(fromIpfs.identity);
    expect(fromDweb.bytes).toEqual(fromIpfs.bytes);
    expect(fromDweb.gatewayId).not.toBe(fromIpfs.gatewayId);
  });

  it('normalizes different gateway URLs to the same canonical identity', async () => {
    const fetchImpl = jest.fn(async () => fakeResponse(EVIDENCE_BYTES));
    const gateway = resolver(fetchImpl as unknown as typeof fetch);

    const a = await gateway.resolve({
      uri: `https://dweb.link/ipfs/${CID_V0}/evidence.json`,
    });
    gateway.clearCache();
    const b = await gateway.resolve({
      uri: `ipfs://${CID_V0}/evidence.json`,
    });

    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.cid).toBe(b.cid);
    expect(a.identity).toBe(b.identity);
  });

  it('does not mutate canonical evidence input on provider failure', async () => {
    const request = Object.freeze({
      uri: `ipfs://${CID_V0}`,
      integrity: Object.freeze({ cid: CID_V0 }),
    });
    const fetchImpl = jest.fn(async () =>
      fakeResponse(new Uint8Array(), { status: 503 }),
    );

    const result = await resolver(fetchImpl as unknown as typeof fetch, {
      policy: { maxAttempts: 1 },
    }).resolve(request);

    expect(result.ok).toBe(false);
    expect(request.uri).toBe(`ipfs://${CID_V0}`);
    expect(request.integrity.cid).toBe(CID_V0);
  });
});
