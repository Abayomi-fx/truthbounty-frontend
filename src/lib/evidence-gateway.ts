/**
 * UI-FE-073 — IPFS gateway integrity and bounded failover.
 *
 * Evidence identity is always the canonical CID (plus DAG path), never the
 * gateway URL. Gateways are untrusted transports: bytes are accepted only after
 * they match CID/integrity metadata. Provider failures never mutate canonical
 * evidence state and never cause unverified bytes to be rendered.
 *
 * Design rules:
 *  - Only approved HTTPS gateways may be contacted.
 *  - Redirects are followed manually and only within approved gateway origins.
 *  - Failover is bounded by the gateway list and `maxAttempts`.
 *  - The cache stores verified bytes only; stale cache entries are never served.
 *  - Unsupported/malformed CIDs and hashes fail closed.
 */

export interface IpfsGateway {
  readonly id: string;
  readonly baseUrl: string;
}

export interface EvidenceGatewayPolicy {
  readonly gateways: readonly IpfsGateway[];
  readonly maxAttempts: number;
  readonly maxRedirectsPerAttempt: number;
  readonly requestTimeoutMs: number;
  readonly maxBytes: number;
  readonly cacheTtlMs: number;
}

export interface EvidenceIntegrityMetadata {
  /** Canonical CID expected by the caller. Must match the URI identity. */
  readonly cid?: string;
  /** Optional SHA-256 metadata, raw hex or `sha256:<hex>`. */
  readonly sha256?: string;
}

export interface EvidenceGatewayRequest {
  readonly uri: string;
  readonly integrity?: EvidenceIntegrityMetadata;
}

export type EvidenceGatewayFailureKind =
  | 'unavailable'
  | 'quarantined'
  | 'mismatch'
  | 'provider-failure';

export type EvidenceGatewayFailureReason =
  | 'invalid-evidence-uri'
  | 'missing-cid'
  | 'unapproved-gateway'
  | 'missing-integrity'
  | 'unsupported-hash'
  | 'cid-mismatch'
  | 'integrity-mismatch'
  | 'oversized'
  | 'stale-cache'
  | 'malformed-response'
  | 'malicious-redirect'
  | 'redirect-limit'
  | 'rate-limited'
  | 'not-found'
  | 'server-error'
  | 'network-error'
  | 'timeout'
  | 'aborted'
  | 'unexpected-status'
  | 'all-gateways-unavailable';

export interface EvidenceGatewayAttempt {
  readonly gatewayId: string;
  readonly url: string;
  readonly outcome: 'verified' | 'failed';
  readonly fromCache: boolean;
  readonly redirects: number;
  readonly status: number | null;
  readonly reason: EvidenceGatewayFailureReason | null;
  readonly kind: EvidenceGatewayFailureKind | null;
}

export interface EvidenceGatewaySuccess {
  readonly ok: true;
  readonly kind: 'verified';
  /** Canonical identity: `ipfs://<cid><path>`; never the gateway URL. */
  readonly identity: string;
  readonly cid: string;
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly size: number;
  readonly contentType: string | null;
  readonly gatewayId: string;
  readonly gatewayUrl: string;
  readonly fromCache: boolean;
  readonly verifiedBy: 'cid' | 'sha256' | 'cid+sha256';
  readonly attempts: readonly EvidenceGatewayAttempt[];
}

export interface EvidenceGatewayFailure {
  readonly ok: false;
  readonly kind: EvidenceGatewayFailureKind;
  readonly reason: EvidenceGatewayFailureReason;
  readonly cid: string | null;
  readonly identity: string | null;
  readonly attempts: readonly EvidenceGatewayAttempt[];
}

export type EvidenceGatewayResult =
  | EvidenceGatewaySuccess
  | EvidenceGatewayFailure;

export interface EvidenceGatewayResolverDeps {
  readonly fetchImpl?: typeof fetch;
  readonly sha256Hex?: (bytes: Uint8Array) => Promise<string>;
  readonly now?: () => number;
  readonly policy?: Partial<EvidenceGatewayPolicy>;
  readonly signal?: AbortSignal;
  readonly onAttempt?: (attempt: EvidenceGatewayAttempt) => void;
}

export const DEFAULT_IPFS_GATEWAY_POLICY: EvidenceGatewayPolicy = Object.freeze({
  gateways: Object.freeze([
    Object.freeze({ id: 'dweb-link', baseUrl: 'https://dweb.link' }),
    Object.freeze({ id: 'ipfs-io', baseUrl: 'https://ipfs.io' }),
  ]),
  maxAttempts: 2,
  maxRedirectsPerAttempt: 2,
  requestTimeoutMs: 8_000,
  maxBytes: 10 * 1024 * 1024,
  cacheTtlMs: 5 * 60 * 1000,
});

interface ParsedCid {
  readonly cid: string;
  readonly version: 0 | 1;
  readonly hashCode: number;
  readonly digest: Uint8Array;
}

interface ParsedEvidenceReference {
  readonly cid: string;
  readonly path: string;
  readonly identity: string;
  readonly parsedCid: ParsedCid;
}

interface CachedEvidence {
  readonly bytes: Uint8Array;
  readonly contentType: string | null;
  readonly verifiedAt: number;
  readonly gatewayId: string;
  readonly gatewayUrl: string;
  readonly verifiedBy: EvidenceGatewaySuccess['verifiedBy'];
}

interface AttemptFailure {
  readonly attempt: EvidenceGatewayAttempt;
  readonly kind: EvidenceGatewayFailureKind;
  readonly reason: EvidenceGatewayFailureReason;
  readonly staleCache: boolean;
}

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
const SHA2_256_CODE = 0x12;
const MAX_EVIDENCE_URI_LENGTH = 2048;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeGatewayBaseUrl(baseUrl: string): string | null {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    if (parsed.search || parsed.hash) return null;
    if (parsed.pathname !== '/' && parsed.pathname !== '') return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function resolvePolicy(
  override: Partial<EvidenceGatewayPolicy> | undefined,
): EvidenceGatewayPolicy {
  const source = override ?? {};
  const rawGateways =
    source.gateways && source.gateways.length > 0
      ? source.gateways
      : DEFAULT_IPFS_GATEWAY_POLICY.gateways;

  const seenIds = new Set<string>();
  const seenOrigins = new Set<string>();
  const gateways: IpfsGateway[] = [];

  for (const gateway of rawGateways) {
    if (!gateway || typeof gateway.id !== 'string' || gateway.id.length === 0) {
      throw new Error('Approved IPFS gateway id must be a non-empty string');
    }
    const baseUrl = normalizeGatewayBaseUrl(gateway.baseUrl);
    if (!baseUrl) {
      throw new Error(`IPFS gateway "${gateway.id}" must be an HTTPS origin`);
    }
    if (seenIds.has(gateway.id) || seenOrigins.has(baseUrl)) {
      throw new Error('Approved IPFS gateways must be unique');
    }
    seenIds.add(gateway.id);
    seenOrigins.add(baseUrl);
    gateways.push(Object.freeze({ id: gateway.id, baseUrl }));
  }

  const requestedAttempts =
    source.maxAttempts ?? DEFAULT_IPFS_GATEWAY_POLICY.maxAttempts;
  const maxAttempts = Math.max(
    1,
    Math.min(Math.floor(requestedAttempts), gateways.length),
  );

  return Object.freeze({
    gateways: Object.freeze(gateways),
    maxAttempts,
    maxRedirectsPerAttempt: Math.max(
      0,
      Math.floor(
        source.maxRedirectsPerAttempt ??
          DEFAULT_IPFS_GATEWAY_POLICY.maxRedirectsPerAttempt,
      ),
    ),
    requestTimeoutMs: Math.max(
      1,
      Math.floor(
        source.requestTimeoutMs ??
          DEFAULT_IPFS_GATEWAY_POLICY.requestTimeoutMs,
      ),
    ),
    maxBytes: Math.max(
      1,
      Math.floor(source.maxBytes ?? DEFAULT_IPFS_GATEWAY_POLICY.maxBytes),
    ),
    cacheTtlMs: Math.max(
      0,
      Math.floor(source.cacheTtlMs ?? DEFAULT_IPFS_GATEWAY_POLICY.cacheTtlMs),
    ),
  });
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(value: string): Uint8Array | null {
  if (value.length === 0 || value.length % 2 !== 0) return null;
  if (!/^[0-9a-f]+$/i.test(value)) return null;
  const output = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    output[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return output;
}

function base58Decode(value: string): Uint8Array | null {
  let number = 0n;
  for (const character of value) {
    const index = BASE58_ALPHABET.indexOf(character);
    if (index === -1) return null;
    number = number * 58n + BigInt(index);
  }

  let hex = number === 0n ? '' : number.toString(16);
  if (hex.length % 2 === 1) hex = `0${hex}`;
  const decoded = hex ? hexToBytes(hex) : new Uint8Array();
  if (!decoded) return null;

  let leadingZeroes = 0;
  for (const character of value) {
    if (character !== '1') break;
    leadingZeroes += 1;
  }

  const output = new Uint8Array(leadingZeroes + decoded.length);
  output.set(decoded, leadingZeroes);
  return output;
}

function base32Decode(value: string): Uint8Array | null {
  let bits = 0;
  let buffer = 0;
  const output: number[] = [];

  for (const rawCharacter of value.toLowerCase()) {
    const index = BASE32_ALPHABET.indexOf(rawCharacter);
    if (index === -1) return null;
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }

  if (bits > 0 && (buffer & ((1 << bits) - 1)) !== 0) {
    return null;
  }
  return Uint8Array.from(output);
}

function hexDecode(value: string): Uint8Array | null {
  return hexToBytes(value);
}

function readVarint(
  bytes: Uint8Array,
  start: number,
): { value: number; offset: number } | null {
  let value = 0;
  let shift = 0;

  for (let offset = start; offset < bytes.length; offset += 1) {
    const byte = bytes[offset];
    value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) {
      if (!Number.isSafeInteger(value)) return null;
      return { value, offset: offset + 1 };
    }
    shift += 7;
    if (shift > 49) return null;
  }
  return null;
}

function parseMultihash(bytes: Uint8Array): {
  hashCode: number;
  digest: Uint8Array;
  end: number;
} | null {
  const code = readVarint(bytes, 0);
  if (!code) return null;
  const length = readVarint(bytes, code.offset);
  if (!length) return null;
  const digestStart = length.offset;
  const digestEnd = digestStart + length.value;
  if (length.value <= 0 || digestEnd > bytes.length) return null;
  return {
    hashCode: code.value,
    digest: bytes.slice(digestStart, digestEnd),
    end: digestEnd,
  };
}

/**
 * Parse a CIDv0 or CIDv1 string. Returns null for malformed values. The hash
 * function may be unsupported for verification; callers must fail closed.
 */
export function parseCid(cid: string): ParsedCid | null {
  if (typeof cid !== 'string' || cid.length === 0 || cid.length > 128) {
    return null;
  }

  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid)) {
    const bytes = base58Decode(cid);
    if (!bytes) return null;
    const multihash = parseMultihash(bytes);
    if (!multihash || bytes.length !== 34 || multihash.end !== bytes.length) {
      return null;
    }
    if (multihash.hashCode !== SHA2_256_CODE || multihash.digest.length !== 32) {
      return null;
    }
    return {
      cid,
      version: 0,
      hashCode: multihash.hashCode,
      digest: multihash.digest,
    };
  }

  let bytes: Uint8Array | null = null;
  if (cid.startsWith('b') || cid.startsWith('B')) {
    bytes = base32Decode(cid.slice(1));
  } else if (cid.startsWith('z')) {
    bytes = base58Decode(cid.slice(1));
  } else if (cid.startsWith('f')) {
    bytes = hexDecode(cid.slice(1));
  }
  if (!bytes) return null;

  const version = readVarint(bytes, 0);
  if (!version || version.value !== 1) return null;
  const codec = readVarint(bytes, version.offset);
  if (!codec || codec.value <= 0) return null;

  const multihashBytes = bytes.slice(codec.offset);
  const multihash = parseMultihash(multihashBytes);
  if (!multihash || multihash.end !== multihashBytes.length) return null;

  return {
    cid,
    version: 1,
    hashCode: multihash.hashCode,
    digest: multihash.digest,
  };
}

function approvedOrigins(policy: EvidenceGatewayPolicy): Set<string> {
  return new Set(policy.gateways.map((gateway) => gateway.baseUrl));
}

/**
 * Extract the canonical CID/path from either `ipfs://` or an approved HTTPS
 * gateway URL. Gateway URLs are accepted only when their origin is approved.
 */
export function parseIpfsEvidenceUri(
  uri: string,
  policy: EvidenceGatewayPolicy = DEFAULT_IPFS_GATEWAY_POLICY,
): ParsedEvidenceReference | null {
  if (typeof uri !== 'string') return null;
  const trimmed = uri.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_EVIDENCE_URI_LENGTH) {
    return null;
  }
  if (/[\u0000-\u0020\u007f-\u009f]/.test(trimmed)) return null;

  let rawCidAndPath: string | null = null;

  if (trimmed.startsWith('ipfs://')) {
    rawCidAndPath = trimmed.slice('ipfs://'.length);
  } else {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return null;
    }
    if (parsed.protocol !== 'https:') return null;
    const origin = normalizeGatewayBaseUrl(parsed.origin);
    if (!origin || !approvedOrigins(policy).has(origin)) return null;
    const match = /^\/ipfs\/([^/]+)(\/.*)?$/.exec(parsed.pathname);
    if (!match) return null;
    rawCidAndPath = `${match[1]}${match[2] ?? ''}`;
  }

  if (!rawCidAndPath) return null;
  rawCidAndPath = rawCidAndPath.split('?')[0].split('#')[0];
  if (rawCidAndPath.startsWith('ipfs/')) {
    rawCidAndPath = rawCidAndPath.slice('ipfs/'.length);
  }
  if (rawCidAndPath.startsWith('/')) {
    rawCidAndPath = rawCidAndPath.slice(1);
  }

  const [cid, ...pathParts] = rawCidAndPath.split('/');
  if (!cid) return null;
  if (
    pathParts.some(
      (part) =>
        part === '.' ||
        part === '..' ||
        /%2e/i.test(part) ||
        /[\u0000-\u001f\u007f]/.test(part),
    )
  ) {
    return null;
  }
  const path = pathParts.length > 0 ? `/${pathParts.join('/')}` : '';
  const parsedCid = parseCid(cid);
  if (!parsedCid) return null;

  return {
    cid,
    path,
    identity: `ipfs://${cid}${path}`,
    parsedCid,
  };
}

export function buildApprovedGatewayUrl(
  gateway: IpfsGateway,
  cid: string,
  path = '',
): string {
  const normalizedPath = path.startsWith('/') ? path : path ? `/${path}` : '';
  return `${gateway.baseUrl}/ipfs/${cid}${normalizedPath}`;
}

function normalizeSha256(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  const hex = trimmed.startsWith('sha256:') ? trimmed.slice(7) : trimmed;
  return /^[0-9a-f]{64}$/.test(hex) ? hex : null;
}

async function defaultSha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('SHA-256 is unavailable');
  }
  const digest = await subtle.digest(
    'SHA-256',
    bytes.slice() as unknown as BufferSource,
  );
  return bytesToHex(new Uint8Array(digest));
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}

function failure(
  attempt: EvidenceGatewayAttempt,
  kind: EvidenceGatewayFailureKind,
  reason: EvidenceGatewayFailureReason,
  staleCache = false,
): AttemptFailure {
  return { attempt, kind, reason, staleCache };
}

function failedAttempt(
  gatewayId: string,
  url: string,
  redirects: number,
  status: number | null,
  kind: EvidenceGatewayFailureKind,
  reason: EvidenceGatewayFailureReason,
): AttemptFailure {
  const attempt: EvidenceGatewayAttempt = {
    gatewayId,
    url,
    outcome: 'failed',
    fromCache: false,
    redirects,
    status,
    reason,
    kind,
  };
  return failure(attempt, kind, reason);
}

function resultFailure(
  kind: EvidenceGatewayFailureKind,
  reason: EvidenceGatewayFailureReason,
  cid: string | null,
  identity: string | null,
  attempts: readonly EvidenceGatewayAttempt[],
): EvidenceGatewayFailure {
  return { ok: false, kind, reason, cid, identity, attempts };
}

export class EvidenceGatewayResolver {
  private readonly fetchImpl: typeof fetch;
  private readonly sha256Hex: (bytes: Uint8Array) => Promise<string>;
  private readonly now: () => number;
  private readonly policy: EvidenceGatewayPolicy;
  private readonly signal?: AbortSignal;
  private readonly onAttempt?: (attempt: EvidenceGatewayAttempt) => void;
  private readonly cache = new Map<string, CachedEvidence>();

  constructor(deps: EvidenceGatewayResolverDeps = {}) {
    const globalFetch = globalThis.fetch;
    this.fetchImpl =
      deps.fetchImpl ??
      (globalFetch ? globalFetch.bind(globalThis) : (undefined as unknown as typeof fetch));
    this.sha256Hex = deps.sha256Hex ?? defaultSha256Hex;
    this.now = deps.now ?? Date.now;
    this.policy = resolvePolicy(deps.policy);
    this.signal = deps.signal;
    this.onAttempt = deps.onAttempt;
  }

  clearCache(): void {
    this.cache.clear();
  }

  get cacheSize(): number {
    return this.cache.size;
  }

  async resolve(
    request: EvidenceGatewayRequest,
  ): Promise<EvidenceGatewayResult> {
    if (!isPlainObject(request) || typeof request.uri !== 'string') {
      return resultFailure('unavailable', 'invalid-evidence-uri', null, null, []);
    }

    const reference = parseIpfsEvidenceUri(request.uri, this.policy);
    if (!reference) {
      const looksLikeGateway = /^https:\/\//i.test(request.uri.trim());
      return resultFailure(
        'unavailable',
        looksLikeGateway ? 'unapproved-gateway' : 'invalid-evidence-uri',
        null,
        null,
        [],
      );
    }

    if (!this.fetchImpl) {
      return resultFailure(
        'unavailable',
        'network-error',
        reference.cid,
        reference.identity,
        [],
      );
    }

    const metadata = request.integrity ?? {};
    if (metadata.cid !== undefined && metadata.cid !== reference.cid) {
      return resultFailure(
        'mismatch',
        'cid-mismatch',
        reference.cid,
        reference.identity,
        [],
      );
    }

    const metadataSha =
      typeof metadata.sha256 === 'string'
        ? normalizeSha256(metadata.sha256)
        : null;
    if (metadata.sha256 !== undefined && metadataSha === null) {
      return resultFailure(
        'quarantined',
        'unsupported-hash',
        reference.cid,
        reference.identity,
        [],
      );
    }

    const cidVerifiable = reference.parsedCid.hashCode === SHA2_256_CODE;
    if (!cidVerifiable && metadataSha === null) {
      return resultFailure(
        'quarantined',
        'unsupported-hash',
        reference.cid,
        reference.identity,
        [],
      );
    }
    const cached = this.cache.get(reference.identity);
    if (cached) {
      const age = this.now() - cached.verifiedAt;
      if (this.policy.cacheTtlMs > 0 && age >= 0 && age <= this.policy.cacheTtlMs) {
        const attempt: EvidenceGatewayAttempt = {
          gatewayId: 'cache',
          url: cached.gatewayUrl,
          outcome: 'verified',
          fromCache: true,
          redirects: 0,
          status: null,
          reason: null,
          kind: null,
        };
        this.onAttempt?.(attempt);
        return {
          ok: true,
          kind: 'verified',
          identity: reference.identity,
          cid: reference.cid,
          path: reference.path,
          bytes: cached.bytes.slice(),
          size: cached.bytes.byteLength,
          contentType: cached.contentType,
          gatewayId: cached.gatewayId,
          gatewayUrl: cached.gatewayUrl,
          fromCache: true,
          verifiedBy: cached.verifiedBy,
          attempts: [attempt],
        };
      }
    }

    const attempts: EvidenceGatewayAttempt[] = [];
    const failures: AttemptFailure[] = [];
    const staleCache = Boolean(cached);
    const gateways = this.policy.gateways.slice(0, this.policy.maxAttempts);

    for (const gateway of gateways) {
      if (this.signal?.aborted) {
        const aborted = failedAttempt(
          gateway.id,
          buildApprovedGatewayUrl(gateway, reference.cid, reference.path),
          0,
          null,
          'unavailable',
          'aborted',
        );
        attempts.push(aborted.attempt);
        this.onAttempt?.(aborted.attempt);
        failures.push(aborted);
        break;
      }

      const attemptResult = await this.fetchFromGateway(
        gateway,
        reference,
        metadataSha,
        cidVerifiable,
      );
      attempts.push(attemptResult.attempt);
      this.onAttempt?.(attemptResult.attempt);

      if ('bytes' in attemptResult) {
        const success = attemptResult;
        const verifiedAt = this.now();
        if (this.policy.cacheTtlMs > 0) {
          this.cache.set(reference.identity, {
            bytes: success.bytes.slice(),
            contentType: success.contentType,
            verifiedAt,
            gatewayId: gateway.id,
            gatewayUrl: success.gatewayUrl,
            verifiedBy: success.verifiedBy,
          });
        }
        return {
          ok: true,
          kind: 'verified',
          identity: reference.identity,
          cid: reference.cid,
          path: reference.path,
          bytes: success.bytes,
          size: success.bytes.byteLength,
          contentType: success.contentType,
          gatewayId: gateway.id,
          gatewayUrl: success.gatewayUrl,
          fromCache: false,
          verifiedBy: success.verifiedBy,
          attempts,
        };
      }

      failures.push(attemptResult);
      if (
        attemptResult.kind === 'mismatch' ||
        attemptResult.kind === 'provider-failure'
      ) {
        // Keep the attempt for observability but still try the remaining
        // approved gateway: another gateway may serve the canonical bytes.
        continue;
      }
      if (attemptResult.kind === 'quarantined') {
        // Oversize/unsupported content from one provider does not prove the
        // content is bad; failover is bounded and the final result fails closed.
        continue;
      }
    }

    const hasMismatch = failures.some((entry) => entry.kind === 'mismatch');
    const hasQuarantine = failures.some((entry) => entry.kind === 'quarantined');
    const hasProviderFailure = failures.some(
      (entry) => entry.kind === 'provider-failure',
    );

    if (hasMismatch) {
      return resultFailure(
        'mismatch',
        'integrity-mismatch',
        reference.cid,
        reference.identity,
        attempts,
      );
    }
    if (hasQuarantine) {
      return resultFailure(
        'quarantined',
        staleCache
          ? 'stale-cache'
          : failures.find((entry) => entry.kind === 'quarantined')!.reason,
        reference.cid,
        reference.identity,
        attempts,
      );
    }
    if (staleCache) {
      return resultFailure(
        'quarantined',
        'stale-cache',
        reference.cid,
        reference.identity,
        attempts,
      );
    }
    if (hasProviderFailure) {
      return resultFailure(
        'provider-failure',
        failures.find((entry) => entry.kind === 'provider-failure')!.reason,
        reference.cid,
        reference.identity,
        attempts,
      );
    }

    return resultFailure(
      'unavailable',
      failures.length > 0
        ? failures[failures.length - 1].reason
        : 'all-gateways-unavailable',
      reference.cid,
      reference.identity,
      attempts,
    );
  }

  private async fetchFromGateway(
    gateway: IpfsGateway,
    reference: ParsedEvidenceReference,
    metadataSha: string | null,
    cidVerifiable: boolean,
  ): Promise<AttemptFailure | {
    attempt: EvidenceGatewayAttempt;
    bytes: Uint8Array;
    contentType: string | null;
    gatewayUrl: string;
    verifiedBy: EvidenceGatewaySuccess['verifiedBy'];
  }> {
    let url = buildApprovedGatewayUrl(gateway, reference.cid, reference.path);
    let redirects = 0;
    let response: Response | null = null;

    while (redirects <= this.policy.maxRedirectsPerAttempt) {
      const request = this.fetchWithTimeout(url);
      try {
        response = await request.response;
      } catch (error) {
        const timeout = request.timedOut();
        return failedAttempt(
          gateway.id,
          url,
          redirects,
          null,
          'unavailable',
          this.signal?.aborted
            ? 'aborted'
            : timeout
              ? 'timeout'
              : isAbortError(error)
                ? 'timeout'
                : 'network-error',
        );
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          return failedAttempt(
            gateway.id,
            url,
            redirects,
            response.status,
            'provider-failure',
            'malformed-response',
          );
        }

        let next: URL;
        try {
          next = new URL(location, url);
        } catch {
          return failedAttempt(
            gateway.id,
            url,
            redirects,
            response.status,
            'provider-failure',
            'malformed-response',
          );
        }

        const origin = normalizeGatewayBaseUrl(next.origin);
        if (
          next.protocol !== 'https:' ||
          !origin ||
          !approvedOrigins(this.policy).has(origin)
        ) {
          return failedAttempt(
            gateway.id,
            url,
            redirects,
            response.status,
            'provider-failure',
            'malicious-redirect',
          );
        }

        redirects += 1;
        if (redirects > this.policy.maxRedirectsPerAttempt) {
          return failedAttempt(
            gateway.id,
            url,
            redirects,
            response.status,
            'provider-failure',
            'redirect-limit',
          );
        }
        url = next.toString();
        continue;
      }
      break;
    }

    if (!response) {
      return failedAttempt(
        gateway.id,
        url,
        redirects,
        null,
        'unavailable',
        'network-error',
      );
    }

    if (response.status === 429) {
      return failedAttempt(
        gateway.id,
        url,
        redirects,
        response.status,
        'unavailable',
        'rate-limited',
      );
    }
    if (response.status === 404 || response.status === 410) {
      return failedAttempt(
        gateway.id,
        url,
        redirects,
        response.status,
        'unavailable',
        'not-found',
      );
    }
    if (response.status >= 500) {
      return failedAttempt(
        gateway.id,
        url,
        redirects,
        response.status,
        'unavailable',
        'server-error',
      );
    }
    if (response.status !== 200) {
      return failedAttempt(
        gateway.id,
        url,
        redirects,
        response.status,
        'unavailable',
        'unexpected-status',
      );
    }

    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > this.policy.maxBytes) {
      return failedAttempt(
        gateway.id,
        url,
        redirects,
        response.status,
        'quarantined',
        'oversized',
      );
    }

    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      return failedAttempt(
        gateway.id,
        url,
        redirects,
        response.status,
        'unavailable',
        isAbortError(error) ? 'timeout' : 'network-error',
      );
    }

    if (bytes.byteLength > this.policy.maxBytes) {
      return failedAttempt(
        gateway.id,
        url,
        redirects,
        response.status,
        'quarantined',
        'oversized',
      );
    }

    let computed: string;
    try {
      computed = await this.sha256Hex(bytes);
    } catch {
      return failedAttempt(
        gateway.id,
        url,
        redirects,
        response.status,
        'quarantined',
        'missing-integrity',
      );
    }

    let verifiedBy: EvidenceGatewaySuccess['verifiedBy'] = 'sha256';
    if (cidVerifiable) {
      const cidDigest = bytesToHex(reference.parsedCid.digest);
      if (computed !== cidDigest) {
        return failedAttempt(
          gateway.id,
          url,
          redirects,
          response.status,
          'mismatch',
          'integrity-mismatch',
        );
      }
      verifiedBy = metadataSha ? 'cid+sha256' : 'cid';
    }

    if (metadataSha && computed !== metadataSha) {
      return failedAttempt(
        gateway.id,
        url,
        redirects,
        response.status,
        'mismatch',
        'integrity-mismatch',
      );
    }

    const attempt: EvidenceGatewayAttempt = {
      gatewayId: gateway.id,
      url,
      outcome: 'verified',
      fromCache: false,
      redirects,
      status: response.status,
      reason: null,
      kind: null,
    };

    return {
      attempt,
      bytes,
      contentType: response.headers.get('content-type'),
      gatewayUrl: url,
      verifiedBy,
    };
  }

  private fetchWithTimeout(url: string): {
    response: Promise<Response>;
    timedOut: () => boolean;
  } {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.policy.requestTimeoutMs);

    const onExternalAbort = () => controller.abort();
    if (this.signal) {
      if (this.signal.aborted) controller.abort();
      else this.signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    const response = Promise.resolve()
      .then(() =>
        this.fetchImpl(url, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            accept: 'application/octet-stream',
          },
        }),
      )
      .finally(() => {
        clearTimeout(timeout);
        this.signal?.removeEventListener('abort', onExternalAbort);
      });

    return { response, timedOut: () => timedOut };
  }
}

export function createEvidenceGatewayResolver(
  deps: EvidenceGatewayResolverDeps = {},
): EvidenceGatewayResolver {
  return new EvidenceGatewayResolver(deps);
}
