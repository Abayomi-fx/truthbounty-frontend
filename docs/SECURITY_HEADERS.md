# UI-FE-092 & V2-FE-131 — Production Browser Security Headers & Embedding Boundaries

## 1. Overview & Problem Statement

A Content Security Policy (CSP) alone does not prove that a deployed web3 frontend maintains a secure browser boundary. Missing, contradictory, or loosely-scoped host headers can expose privileged surfaces (such as transaction confirmations, bounty claim submissions, and Worldcoin identity verifications) to:
- **Framing & Clickjacking:** UI redressing where an attacker embeds TruthBounty inside an iframe to hijack wallet approvals.
- **MIME Confusion & Content Sniffing:** Browsers interpreting untrusted uploads or text responses as executable scripts.
- **Excessive Referrer Leakage:** Exposing query parameters, wallet addresses, or private investigation URLs across third-party networks.
- **Unrestricted Browser APIs:** Malicious third-party scripts or compromised dependencies accessing device sensors, camera/microphone, or USB hardware.
- **Cache Poisoning & Insecure History Persistence:** Sensitive claim data or dynamic wallet state stored in shared intermediate HTTP proxies.

This document establishes the canonical browser security header policy, embedding boundary enforcement, least-permissive permissions posture, and deployment verification gates across all TruthBounty environments.

---

## 2. Canonical Header Policy

| Header | Production Baseline | Host / Source | Rationale & Guardrails |
| :--- | :--- | :--- | :--- |
| `Strict-Transport-Security` (HSTS) | `max-age=63072000; includeSubDomains; preload` | Next.js `headers()` + CDN | Enforces TLS across all subdomains for 2 years; eligible for HSTS preload list. |
| `Content-Security-Policy` | Nonce-based strict CSP with `frame-ancestors 'none'` | Middleware (`middleware.ts`) | Restricts script execution to per-request cryptographically secure nonces; strictly forbids framing. |
| `X-Frame-Options` | `DENY` | Next.js `headers()` + Middleware | Legacy defense-in-depth against framing for user agents lacking full CSP Level 3 support. |
| `X-Content-Type-Options` | `nosniff` | Next.js `headers()` (`/:path*`) | Blocks MIME type sniffing; prevents script execution from non-script MIME types. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Next.js `headers()` (`/:path*`) | Strips path/query data on cross-origin requests; sends full origin only to secure origins. |
| `Permissions-Policy` | `camera=(self "https://id.worldcoin.org"), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), screen-wake-lock=(), accelerometer=(), gyroscope=(), magnetometer=(), midi=(), encrypted-media=()` | Next.js `headers()` + Middleware | Least-permissive posture; disables all unneeded hardware sensors and native payment APIs while scoping camera exclusively to Worldcoin IDKit. |
| `Cross-Origin-Opener-Policy` (COOP) | `same-origin-allow-popups` | Next.js `headers()` (`/:path*`) | Isolates browsing context while permitting necessary wallet popups (Rainbow, WalletConnect, MetaMask). |
| `Cross-Origin-Resource-Policy` (CORP) | `same-site` | Next.js `headers()` (`/:path*`) | Restricts resource loading to same-site origins to mitigate Spectre/side-channel attacks. |
| `X-DNS-Prefetch-Control` | `off` | Next.js `headers()` (`/:path*`) | Prevents speculative DNS prefetching that could leak user viewing habits to network eavesdroppers. |
| `Cache-Control` (Document / API) | `no-store, max-age=0, must-revalidate` | Next.js `headers()` + Route handlers | Prevents intermediate caches and shared proxies from persisting dynamic wallet and claim data. |
| `Cache-Control` (Static Assets) | `public, max-age=31536000, immutable` | Next.js `headers()` (`/_next/static/:path*`) | Immutable, long-lived caching for content-hashed static JavaScript and CSS chunks. |

---

## 3. Embedding Boundaries & Clickjacking Defense

TruthBounty executes non-repudiable blockchain transactions, token transfers, and cryptographic identity attestations. Consequently, **all external embedding is strictly forbidden**:

1. **CSP `frame-ancestors 'none'`**: Enforced on all HTML document responses. Prevents embedding in `<frame>`, `<iframe>`, `<object>`, or `<embed>` tags by any origin.
2. **`X-Frame-Options: DENY`**: Served alongside CSP as defense-in-depth for older user agents and edge caches.
3. **Approved Exceptions**: There are **zero** approved external framing exceptions for TruthBounty top-level applications. Any integration requiring iframe embedding must receive security council approval and architectural review.

---

## 4. Environment Differences Matrix

The repository enforces strict separation between development, preview, testnet, and production environments:

| Boundary / Directive | Local Development | Hosted Preview | Sepolia Testnet | Production (Mainnet) |
| :--- | :--- | :--- | :--- | :--- |
| **HTTPS Required** | No (`http://localhost:*`) | Yes (`https://*.preview.*`) | Yes (`https://testnet.*`) | Yes (`https://truthbounty.io`) |
| **HSTS Enforcement** | Skipped for plaintext HTTP | Enforced (`max-age=63072000`) | Enforced (`max-age=63072000`) | Enforced (`max-age=63072000`) |
| **Script Eval (`'unsafe-eval'`)** | Allowed (Next.js Fast Refresh) | **Forbidden** | **Forbidden** | **Forbidden** |
| **Localhost Connect Origins** | Allowed (`http://`, `ws://`) | **Forbidden** | **Forbidden** | **Forbidden** |
| **Network RPC (`connect-src`)** | Localhost + Sepolia/Mainnet | Testnet RPCs | `https://sepolia.optimism.io` | `https://mainnet.optimism.io` |
| **Target Chain ID** | Configurable (`31337`, `11155420`) | Sepolia (`11155420`) | Sepolia (`11155420`) | Optimism Mainnet (`10`) |
| **Insecure Requests Upgrade** | Skipped | Enforced (`upgrade-insecure-requests`) | Enforced (`upgrade-insecure-requests`) | Enforced (`upgrade-insecure-requests`) |
| **Embedding Boundary** | `frame-ancestors 'none'` | `frame-ancestors 'none'` | `frame-ancestors 'none'` | `frame-ancestors 'none'` |

> [!IMPORTANT]
> **Constraint Enforcement:** As required by protocol governance, headers cannot be claimed as enforced if only development middleware provides them. `next.config.ts` statically injects security headers across all routes (`/:path*`), ensuring that production bundles, static serverless edge nodes, and API routes always emit compliant headers regardless of middleware execution.

---

## 5. Third-Party & Wallet Integration Compatibility

The security posture minimizes exposure while preserving full compatibility with required protocol dependencies:

### WalletConnect & RainbowKit
- **`connect-src`**:
  - `https://*.walletconnect.com`
  - `https://*.walletconnect.org`
  - `wss://*.walletconnect.com`
  - `wss://*.walletconnect.org`
  - `https://verify.walletconnect.com`
  - `https://verify.walletconnect.org`
  - `https://explorer-api.walletconnect.com`
- **`frame-src`**:
  - `https://verify.walletconnect.com`
  - `https://verify.walletconnect.org` (allows WalletConnect domain verification modal)
- **`script-src`**:
  - `'wasm-unsafe-eval'` (required for WebAssembly cryptography routines in wallet connectors).
- **`Cross-Origin-Opener-Policy`**:
  - Must remain `same-origin-allow-popups`. A strict `same-origin` COOP breaks popup window references used by mobile wallet QR code and extension bridge dialogues.

### Worldcoin IDKit
- **`connect-src`**: `https://id.worldcoin.org`, `https://*.worldcoin.org`
- **`frame-src`**: `https://id.worldcoin.org` (allows mounting the World ID verification modal).
- **`Permissions-Policy`**: `camera=(self "https://id.worldcoin.org")` enables QR code scanning inside the IDKit iframe while preventing unauthorized third-party camera access.

---

## 6. Deployment Verification Script (`verify-security-headers.mjs`)

The deployment verification suite validates both built artifacts and live hosted applications:

```bash
# Verify static configuration drift and local baseline (CI prebuild)
node scripts/verify-security-headers.mjs --static-only

# Generate canonical environment evidence files
node scripts/verify-security-headers.mjs --generate-evidence

# Verify a live preview or production deployment
node scripts/verify-security-headers.mjs --url https://preview.truthbounty.io --env preview
node scripts/verify-security-headers.mjs --url https://testnet.truthbounty.io --env testnet
node scripts/verify-security-headers.mjs --url https://truthbounty.io --env production
```

### Verification Capabilities
1. **Header Assertion:** Validates all required headers against exact values or minimum criteria (e.g. HSTS duration).
2. **Negative Tests:**
   - Proves framing is denied (verifies that `X-Frame-Options` is not `ALLOW-FROM` and `frame-ancestors` does not contain wildcards).
   - Proves high-risk hardware APIs (microphone, geolocation, usb, payment) are completely disabled.
   - Proves `'unsafe-eval'` is absent in preview, testnet, and production CSPs.
3. **Configuration Drift Detection:** Compares `next.config.ts`, `middleware.ts`, and `src/lib/security/headers.ts` with `security-headers-policy.json`. Drift fails with an actionable exit code 1.
4. **Evidence Generation:** Emits cryptographically-hashed JSON evidence files for release verification under `reports/`.

---

## 7. Release Gate & CI Integration

The browser security gate is enforced at three distinct levels in the development lifecycle:

1. **Prebuild Hook (`package.json`)**:
   `npm run prebuild` triggers `node scripts/verify-security-headers.mjs --static-only`. Any header drift or missing configuration halts the build immediately.
2. **Dedicated CI Job (`.github/workflows/ci.yml`)**:
   The `security-headers` job runs on all pull requests and pushes to `main`. It executes both unit tests (`verify-security-headers.test.mjs`) and drift verification, uploading the resulting evidence artifact `security-headers-evidence` to GitHub Actions.
3. **E2E Gate Dependency**:
   The `e2e` Playwright test suite depends on `security-headers` passing, ensuring tests only execute against compliant configurations.
