# V2-FE-131 — Content Security Policy & Security Headers

## Purpose

Enforce browser security headers for the TruthBounty frontend without fabricating protocol outcomes or weakening wallet / identity flows.

## Behavior

| Header | Source | Notes |
| --- | --- | --- |
| `Content-Security-Policy` | `src/middleware.ts` | Per-request nonce; scripts use `nonce` + `strict-dynamic` |
| HSTS, `X-Content-Type-Options`, `X-Frame-Options`, Referrer-Policy, Permissions-Policy, COOP, CORP | middleware + `next.config.ts` | Static headers also apply to static assets |

## Nonce wiring

1. Middleware generates a nonce and sets `x-nonce` on the request.
2. `src/app/layout.tsx` reads `x-nonce` and passes it to `ThemeInitScript`.
3. CSP `script-src` allows only that nonce (plus `strict-dynamic` for trusted chain).

## Failure / degraded posture

- Missing nonce → `buildContentSecurityPolicy` throws (fail closed).
- Report-only mode available via `reportOnly: true` for staged rollout; default is enforce.
- Camera is permitted only for self + Worldcoin IDKit; mic/geo/payment/usb stay closed.
- COOP is `same-origin-allow-popups` so wallet connect popups continue to work.

## Tests

```bash
pnpm test -- src/__tests__/security-headers.test.ts
```

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

Dependencies #559, #566 and #623 remain open. The current lockfile references
`typescript@7.0.2` without a corresponding entry, preventing a frozen install.
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
