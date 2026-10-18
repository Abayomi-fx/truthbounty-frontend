# IPFS Gateway Integrity and Safe Failover (UI-FE-073)

This boundary resolves IPFS evidence through an approved gateway policy while
keeping the canonical CID as the evidence identity. Gateway URLs are treated as
untrusted transports, never as identity or authority.

Implementation: [`src/lib/evidence-gateway.ts`](../src/lib/evidence-gateway.ts)

## Identity

- `identity = ipfs://<cid><dag-path>`.
- `https://dweb.link/ipfs/<cid>/file` and `https://ipfs.io/ipfs/<cid>/file`
  normalize to the same identity.
- A gateway URL from an unapproved origin is rejected.
- Path traversal (`.` / `..` / encoded `%2e`) and control characters are
  rejected before any request.

## Approved gateway policy

`DEFAULT_IPFS_GATEWAY_POLICY` pins:

| Setting | Default |
|---|---|
| Gateways | `https://dweb.link`, `https://ipfs.io` |
| Maximum attempts | 2 (never more than the approved gateway list) |
| Redirects per attempt | 2, same/approved-origin only |
| Request timeout | 8 seconds |
| Maximum body size | 10 MiB |
| Verified cache TTL | 5 minutes |

Only HTTPS gateway origins are accepted. Redirects are followed manually with
`redirect: 'manual'`; a redirect to any origin outside the approved gateway list
is a `malicious-redirect` provider failure.

## Integrity verification

Bytes are accepted only after verification:

- CIDv0 base58btc and CIDv1 base32/base58btc/base16 are parsed locally.
- SHA-256 CIDs are verified against the CID multihash.
- Optional integrity metadata (`sha256:<hex>` or raw hex) is verified as well.
- A CID whose hash function is unsupported fails closed (`quarantined`) unless
  independent SHA-256 metadata is supplied.
- The cache stores verified bytes only. Stale entries are never served; if the
  gateways are down, a stale entry produces `quarantined/stale-cache`.

## Result classes

| Kind | Meaning |
|---|---|
| `verified` | Bytes match CID/integrity metadata; `bytes` is safe to render |
| `unavailable` | No approved gateway could provide bytes (outage, timeout, 5xx, 429, 404) |
| `quarantined` | Bytes cannot be trusted/rendered (oversized, unsupported hash, stale cache) |
| `mismatch` | Bytes were returned but did not match the CID/integrity metadata |
| `provider-failure` | Gateway misbehaved (malicious redirect, malformed response) |

Only `verified` results expose `bytes`. Every failure result omits bytes, so a
caller that renders only `verified.bytes` cannot render an integrity mismatch.

Every attempt is recorded in `attempts[]` with gateway id, status, redirect
count, failure reason, and failure kind. `onAttempt` provides the same stream
for telemetry (gateway ids/reasons only; no evidence payloads).

## Failure and cache invariants

- Provider failures never write the verified cache.
- Failover is bounded by `maxAttempts` and the approved gateway list.
- Stale cache entries are never served as verified content.
- The request object is not mutated.
- Integrity metadata that names a different CID fails before any network call.

## UI integration

`getSafeEvidenceHref` now builds IPFS links through
`DEFAULT_IPFS_GATEWAY_POLICY` rather than a hard-coded gateway. Consumers that
need verified bytes must call `EvidenceGatewayResolver.resolve()` and render
only on `ok: true`.

Blocked/mismatched evidence must render an accessible fail-closed state
(`role="alert"` for failures, `role="note"` for quarantined/blocked content) and
must never fall back to gateway-provided bytes.

## Tests

`src/lib/__tests__/evidence-gateway.test.ts` covers:

- primary outage and bounded failover;
- all-gateway unavailability and rate limiting;
- content mismatch and CID/integrity metadata mismatch;
- stale cache (never served);
- malicious redirects and safe same-origin redirects;
- oversized bodies and unsupported hash functions;
- gateway URL vs canonical identity;
- cross-gateway byte equivalence;
- request immutability on provider failure.

Existing URI/sanitizer suites also run against the updated gateway policy.
