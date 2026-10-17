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

### Reviewed provider origins

The exact origins in `src/lib/security/provider-policy.mjs` govern browser egress.
WalletConnect uses scoped relay/RPC, verification and explorer origins; World ID
uses `https://id.worldcoin.org`. Wildcard wallet, Worldcoin and RPC permissions
are not retained. Explicit testnet and production environments narrow the
reviewed Optimism RPC set to their chain. Other reviewed providers retain their
existing permissions pending the production rehearsal described below.

COOP remains `same-origin-allow-popups`, scripts retain `'wasm-unsafe-eval'`, and
camera access remains limited to self and `https://id.worldcoin.org`.
Actual supported-wallet compatibility still requires the trusted rehearsal;
static policy checks alone do not establish it.

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
   `npm run prebuild` retains the provider, artifact, production-boundary, fixture-determinism and accessibility checks. The dedicated security-header job separately runs `node scripts/verify-security-headers.mjs --static-only`.
2. **Dedicated CI Job (`.github/workflows/ci.yml`)**:
   The `security-headers` job runs on all pull requests and pushes to `main`. It executes both unit tests (`verify-security-headers.test.mjs`) and drift verification, uploading the resulting evidence artifact `security-headers-evidence` to GitHub Actions.
3. **E2E Gate Dependency**:
   The `e2e` Playwright test suite depends on `security-headers` passing, ensuring tests only execute against compliant configurations.


## UI-FE-060: provider review and drift gate

`src/lib/security/provider-policy.mjs` is the browser egress authority. Each exact
origin names an owner, purpose, directive and source linkage. Source linkage alone
is not proof that an SDK uses an origin. Both middleware
entry points and the legacy `renderCspHeader` facade use `headers.ts`. No production
network directive allows a wildcard or unrestricted HTTPS/WSS scheme. Explorer
and support **navigation** links do not need connect-src permission. Fonts are
served locally by Next; no browser Google Fonts exception is retained.

The API and WebSocket deployment hosts have not been pinned by #559. Same-origin
API use is permitted; a deployment using an external host must add its exact
origin, purpose and owner through policy review. Public RPC/API/WS environment
values select an already-reviewed origin; they never grant permission. Rejected
values are not included in errors. Local HTTP/WS endpoints are development-only.
No external analytics or support submission service is currently authorized.
Analytics consent does not itself authorize network access. Unknown evidence
image hosts are blocked; safe external navigation/copy remain separate concerns
owned by #566. New gateway/SDK endpoints require review rather than a wildcard.

Script nonces and strict-dynamic remain enforced; malformed nonces fail closed.
The existing wasm exception supports wallet helpers. Existing inline style support
is retained for Tailwind/Radix. Self/blob workers and self/data/blob images are
local-resource exceptions, not arbitrary remote-origin grants.

### CI and policy changes

- `pnpm verify:providers`: validate origin scope/ownership/usage evidence, then
  compare the AST source inventory and dependency fingerprints to
  `src/lib/security/provider-review.json`.
- `pnpm test:providers`: production headers, hostile origin/nonce/environment
  fixtures, real verifier drift rejection and CSP report privacy.
- `pnpm test:csp-browser`: builds this checkout and starts `next start` on a
  dedicated port with production mode and the E2E harness disabled. It checks
  real middleware headers, fresh nonces and the Next bootstrap, exercises named
  UI flows, and requires successful browser requests for each origin/directive.
  There is no intercepted HTML, response fulfillment, direct test fetch to an
  allowed host, or fallback to a synthetic page. A separate production-page test
  checks the blob-worker permission and the app's analytics consent controls.

The prebuild and unprivileged PR CI job enforce the static gate. The separate
manual CSP rehearsal enforces runtime usage; a green PR job is not runtime evidence.
For provider changes, inspect new call sites and SDK endpoints, update scoped provider entries and smoke tests,
then explicitly update the reviewed source inventory/dependency hashes. Do not
blindly regenerate it to make CI pass. `inventory()` and `digest()` exported by
`scripts/verify-provider-drift.mjs` provide deterministic values (CRLF normalized).
The existing security CODEOWNER rule covers both policy and review inventory;
maintainer approval of the exact PR head remains required.

The scanner detects URL literals (including escaped strings/template heads),
environment reads and common network constructors/calls in production source,
plus remote asset references. Any changed call site requires review even if its
URL is computed. This is conservative review evidence, not whole-program data-flow
analysis: arbitrarily aliased or obfuscated calls are not proven safe. CSP still
blocks undeclared destinations at runtime. Dependency/lockfile drift requires SDK
review because source scans cannot infer third-party network behavior.

### Reporting privacy

Both legacy and Reporting API payloads retain only an allowlisted directive,
`enforce`/`report` disposition, and an integer HTTP status. Document/blocked/source
URLs, samples, referrers, original policy and arbitrary field strings are never
logged, including origins whose subdomains may identify users. Existing 16 KiB
stream limits and malformed-payload rejection remain in place.

### Current integration limits

Dependency #559 is closed; #566 and #623 remain open as of the conflict resolution. The lockfile repair from upstream `e8eec40` permits a frozen installation.
Full runtime verification and canonical rehearsal inputs remain separate gates.
Independent policy and browser checks do not substitute for a complete Next
production build or live credentialed wallet/World ID rehearsal. The exact wallet
origins narrow the previous policy; deployments must rehearse their pinned SDK
versions before release and review any additional required endpoint explicitly.


### Per-origin review obligations and real runtime evidence

`provider-usage.mjs` independently enumerates each provider/origin/directive and
its required scenario. Appending an origin to an existing provider or adding a
new directive fails `verify:providers` unless that exact tuple has a binding.
Adding the binding alone still does not pass the browser gate: it requires an
observed successful request of the matching resource type in that scenario.
WebSockets require a received frame, not merely socket construction. Third-party
iframe subresources do not count as permissions used by our top-level document.
Regression tests cover an extra unused exact origin with unchanged source
linkage, an extra directive, missing/failed observations for every tuple, and a
new binding with no browser observation. The static gate verifies obligations;
only a successful production browser run establishes usage.

Provide `CSP_FLOW_PROFILE` as JSON with nonempty arrays for `rpc`, `projection`,
`walletconnect`, `world-id` and `evidence`. Each flow has a same-app `route`, a
`clicks` array of `{ "role": "button" | "link", "name": "exact accessible name" }`,
and a `visible` object with the same action shape identifying the final visible
UI element. Use the approved routes, fixture identifiers and accessible names
from the canonical app after dependencies merge, not invented providers or
mock-proof routes. Multiple flows permit supported chains and wallet variants.
This profile is operator-supplied test input, not permission to expand CSP.

Real public wallet/RPC/API/World ID configuration and any server-side RP context
must also be available to the production build/server. A local `CSP_STORAGE_STATE`
file may provide an authorized test session; never commit it or print its values.
Fork PR workflows cannot receive repository secrets, even after workflow approval.
The PR provider job therefore runs only the static verifier and policy tests.
Credentialed browser coverage lives in `csp-rehearsal.yml`, with no PR trigger.
A storage state does not replace an actual wallet connector or identity authorization. Profiles that
cannot reach the installed SDK flow fail; they do not silently skip it.

No approved flow profile, live wallet fixture or canonical post-dependency
configuration is committed here. This suite is consequently **not yet verified
against production integrations**. In particular, the current allowlist's SDK
hosts remain candidates until observed; unused hosts must be removed after that
rehearsal, rather than adding fake requests to satisfy the test. The local worker
probe tests the actual document's CSP, not a nonexistent product worker flow.
Analytics currently emits local consent-gated events, not third-party traffic.

The maintainer requested waiting for #559/#566/#623 and activation confirmation
before final integration. After those merge and the upstream lockfile is repaired,
integrate upstream without rewriting this published branch, supply the canonical
profile, run the full requested repository and wallet suites, and request human
security review on the resulting exact head. The earlier synthetic smoke result
must not be reported as evidence for this replacement suite.

### Maintainer-controlled rehearsal setup

This is a proposed execution path, not an activated environment or a passing run.
After #559/#566/#623, lockfile repair and explicit task activation, an upstream
maintainer must:

1. Land the reviewed rehearsal workflow on upstream `main` (it must exist on the
   default branch to dispatch). Protect the upstream `csp-rehearsal` branch and
   place the reviewed candidate commit there. Preserve the exact PR SHA when
   possible; a merge/cherry-pick produces a different SHA and is not exact-head
   evidence for the PR.
2. Create the `csp-rehearsal` GitHub environment with required security reviewers,
   prevent self-review, and restrict deployment branches to `main`. Workflow YAML
   alone does not configure these protections. Do not approve an unreviewed
   candidate, including its install/build scripts and dependencies.
3. Set environment variables `CSP_REHEARSAL_ACTIVATED=true`, `CSP_APPROVED_SHA`
   (the full reviewed candidate SHA), `CSP_FLOW_PROFILE`, and canonical public
   RPC/API/WS/World ID settings. Store `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` as
   an environment secret. If needed, store an authorized Playwright storage-state
   JSON as `CSP_STORAGE_STATE_JSON`; never include wallet keys or production-user
   sessions. The workflow writes it only to a temporary file and removes it on exit.
4. Dispatch **CSP production rehearsal** from `main`, supplying `reviewed_sha`.
   The job rejects inactive/missing approval, mismatched SHAs, and candidates not
   at the tip of upstream `csp-rehearsal` before checking out or executing code.
   Checkout uses the immutable SHA with credentials persistence disabled. The
   read-only job does not fetch fork refs, restore PR caches or upload session,
   browser trace, or build artifacts.
5. After environment approval, the job performs the frozen install, static checks,
   lint, type-check, unit/integration tests, production build (via the CSP browser
   configuration), and real browser rehearsal. Record its run URL and tested SHA
   alongside the separately required repository wallet/provider and E2E results.
   A dispatch result does not automatically satisfy PR required checks or replace
   exact-head human security approval. Any new commit needs a new approved SHA/run.

Do not use `pull_request_target` to execute contributor code with secrets. The
existing repository-wide E2E job also uses a repository WalletConnect secret;
its fork behavior is pre-existing and requires a separate canonical CI decision.
This change only moves the CSP rehearsal added by #631 out of fork PR execution.
