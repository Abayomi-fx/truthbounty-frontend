# UI-FE-092: Verify Production Browser Security Headers & Embedding Boundaries

## Pull Request Summary

### Issue Reference
**UI-FE-092 (#663)** — Verify production browser security headers and embedding boundaries

---

## Overview

A frontend Content Security Policy (CSP) alone does not prove the deployed TruthBounty application maintains the complete browser-security posture required for non-repudiable wallet transactions, cryptographic evidence submissions, and Worldcoin identity attestations. Missing or conflicting host headers can permit framing (clickjacking), MIME sniffing confusion, excessive referrer leakage, or unsafe hardware sensor access.

This implementation establishes:
1. **Canonical Browser Security Policy:** Defined in `src/config/security-headers-policy.json`, formalizing strict requirements for HSTS, frame-ancestors, X-Content-Type-Options, Referrer-Policy, least-permissive Permissions-Policy, COOP, CORP, and caching boundaries.
2. **Hardened Static & API Configuration:** Configured in `next.config.ts` and `src/lib/security/headers.ts` so headers are applied at the server/edge level to all routes (`/:path*`), API routes (`/api/:path*`), and static assets (`/_next/static/:path*`), ensuring headers are not solely dependent on development middleware.
3. **Deployment Verification Script:** Implemented in `scripts/verify-security-headers.mjs` with support for static drift detection, negative framing/capability tests, wallet and third-party integration compatibility checks, live endpoint verification, and cryptographic evidence generation.
4. **Separate Preview, Testnet, and Production Evidence:** Emitted under `reports/` (`evidence-preview.json`, `evidence-testnet.json`, `evidence-production.json`), independently verifying Sepolia testnet and Optimism mainnet configurations.
5. **CI / Release Gate Integration:** Integrated into `package.json` (`prebuild`, `verify:security-headers`, `test:security-headers:unit`) and `.github/workflows/ci.yml` (`security-headers` gate job) to fail builds closed on drift.
6. **Comprehensive Documentation:** Created `docs/SECURITY_HEADERS.md` and `docs/RELEASE_GATE_SECURITY_HEADERS.md`.

---

## Deliverables & Acceptance Criteria Mapping

| Deliverable / Acceptance Criteria | Status | Implementation Details |
| :--- | :---: | :--- |
| **1. Header Policy** | Complete | Defined in `src/config/security-headers-policy.json` and `src/lib/security/headers.ts`. Covers HSTS, CSP, XFO, XCTO, Referrer, Permissions-Policy, COOP, CORP, and Caching boundaries. |
| **2. Verification Script** | Complete | `scripts/verify-security-headers.mjs` provides CLI flags (`--url`, `--env`, `--report-file`, `--static-only`, `--generate-evidence`), negative tests, and drift detection. |
| **3. Negative Tests** | Complete | Unit and deployment negative tests verify framing is denied (`frame-ancestors 'none'`, `X-Frame-Options: DENY`), high-risk features (`microphone`, `geolocation`, `payment`, `usb`, `display-capture`) are blocked, and `'unsafe-eval'` is absent outside local development. |
| **4. Wallet & Third-Party Integrations** | Complete | Verified WalletConnect (`connect-src`, `frame-src`, `same-origin-allow-popups` COOP, WASM), Worldcoin (`camera=(self "https://id.worldcoin.org")`, `frame-src`), and chain RPC endpoints (`sepolia.optimism.io` on testnet, `mainnet.optimism.io` on production). |
| **5. Caching Boundaries** | Complete | HTML documents and API routes enforce `Cache-Control: no-store, max-age=0, must-revalidate` and `Pragma: no-cache`. Static assets enforce `public, max-age=31536000, immutable`. |
| **6. Preview & Testnet Evidence** | Complete | `reports/evidence-preview.json`, `reports/evidence-testnet.json`, and `reports/evidence-production.json` generated with SHA-256 integrity digests. |
| **7. Release Gate Documentation** | Complete | Documented in `docs/RELEASE_GATE_SECURITY_HEADERS.md` and `docs/SECURITY_HEADERS.md`. |
| **8. CI / Release Gate Drift Detection** | Complete | Added `npm run verify:security-headers` to `prebuild` in `package.json` and added a dedicated `security-headers` job in `.github/workflows/ci.yml`. |

---

## Constraints Verification

1. **No Development-Only Enforcement Claims:**
   - Headers are configured in `next.config.ts` via `buildStaticSecurityHeaders()` on `/:path*` and `buildApiSecurityHeaders()` on `/api/:path*`.
   - The verification script tests the actual HTTP responses and build-time route manifests, refusing to pass if headers exist only in development middleware.
2. **No Policy Weakening for Undocumented Integrations:**
   - Permissions-Policy is locked down to `microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), screen-wake-lock=(), accelerometer=(), gyroscope=(), magnetometer=(), midi=(), encrypted-media=()`.
   - Camera is strictly scoped to `(self "https://id.worldcoin.org")` for World ID verification.
   - Framing is strictly `DENY` / `frame-ancestors 'none'` with zero unapproved exceptions.
3. **Separate Evidence for Testnet and Mainnet:**
   - Testnet evidence (`reports/evidence-testnet.json`) verifies Chain ID `11155420` and `https://sepolia.optimism.io`.
   - Production evidence (`reports/evidence-production.json`) verifies Chain ID `10` and `https://mainnet.optimism.io`.
   - Digests are distinct and independently verified.

---

## Verification & Test Results

```bash
# 1. Run script unit tests
node --test scripts/__tests__/verify-security-headers.test.mjs
# Result: 10 passed, 0 failed

# 2. Run static verification & evidence generation
node scripts/verify-security-headers.mjs --static-only --generate-evidence
# Result: All drift checks passed, canonical evidence written

# 3. Run Jest security header test suite
npm test -- src/__tests__/security-headers.test.ts
# Result: 8 passed, 0 failed
```

