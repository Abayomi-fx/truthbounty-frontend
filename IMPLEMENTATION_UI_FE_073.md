# UI-FE-073 — Verify IPFS Gateway Integrity and Safe Failover

**Issue:** [#644](https://github.com/DigiNodes/truthbounty-frontend/issues/644)
**Branch:** `feat/ui-fe-073-ipfs-gateway-integrity-failover`
**Base:** upstream `main`

## Overview

Adds a reusable production boundary for IPFS evidence resolution. The canonical
CID (plus DAG path) is the only evidence identity; gateway URLs are untrusted
transports. Bytes are accepted only after CID/integrity verification, failover
is bounded to approved gateways, and stale cache entries are never served.

## Files

- **[ADD]** `src/lib/evidence-gateway.ts`
  - Approved HTTPS gateway policy (`dweb.link`, `ipfs.io`) with bounded attempts,
    redirects, timeout, body size, and verified-cache TTL.
  - Manual redirect handling; cross-origin/unapproved redirects fail as
    `malicious-redirect`.
  - CIDv0/CIDv1 parsing (base58btc/base32/base16) and SHA-256 CID verification.
  - Optional `sha256` integrity metadata verification.
  - Result classes: `verified`, `unavailable`, `quarantined`, `mismatch`,
    `provider-failure`.
  - Observable attempt log and `onAttempt` callback.
  - Verified-bytes-only cache; stale entries are never served.

- **[MODIFY]** `src/lib/validation/evidenceUri.ts`
  - `getSafeEvidenceHref` now builds IPFS links through the approved gateway
    policy instead of a hard-coded gateway.

- **[ADD]** `src/lib/__tests__/evidence-gateway.test.ts`

- **[ADD]** `docs/IPFS_GATEWAY_INTEGRITY.md`

## Acceptance Criteria

| Criterion | Evidence |
|---|---|
| Gateway URL is never treated as evidence identity | `identity` is always `ipfs://<cid><path>`; gateway URLs from different approved origins normalize to the same identity |
| Integrity mismatch blocks rendering | Failure results never expose `bytes`; mismatch tests assert no bytes and cache remains unwritten |
| Failover remains bounded and observable | `maxAttempts` clamps to the approved list; every attempt is returned in `attempts[]` and emitted via `onAttempt` |
| Provider failures do not mutate canonical evidence state | Cache writes occur only after verification; frozen request test proves no input mutation |

## Required Tests

- Primary outage / failover: covered.
- Content mismatch: covered.
- Stale cache: covered.
- Rate limit: covered.
- Malicious redirect: covered.
- Cross-gateway byte equivalence: covered.
- Additional: all-gateway outage, bounded attempts, oversized body, unsupported
  hash, same-origin redirect, CID metadata mismatch, request immutability.

## Verification

```text
Test Suites: 3 passed, 3 total
Tests:       97 passed, 97 total
```

Suites: `evidence-gateway.test.ts` (20), `evidenceUri.test.ts` (existing),
`evidence-sanitizer.test.ts` (existing).

Targeted TypeScript check of the new boundary, URI integration, and tests
completed with 0 errors.

Full-repo `tsc`/ESLint remain blocked by pre-existing `main` failures unrelated
to this change (broken `src/app/queries/queryKeys.ts` syntax and the
`eslint-plugin-react@7.37.5` / ESLint 10 incompatibility).

## Non-Goals

- No board redesign.
- No API/contract behavior invented.
- No evidence storage or on-chain commitment changes.
- No `Stellar Wave` label changes.
