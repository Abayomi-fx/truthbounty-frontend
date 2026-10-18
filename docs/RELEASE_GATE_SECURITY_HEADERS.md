# Release Gate: Browser Security Headers & Embedding Boundaries (UI-FE-092)

## Purpose

This release-gate document governs the deployment verification process for TruthBounty browser security headers, embedding boundaries, and caching policies. It provides maintainers and release engineers with actionable steps to verify candidates, triage drift failures, and maintain separate evidence across Preview, Testnet, and Mainnet deployments.

---

## Release Criteria Checklist

Before any candidate frontend build can be promoted to staging, testnet, or production, it must satisfy all four gates:

- [x] **Gate 1: Prebuild Configuration Drift Check**
  - Executed via `npm run verify:security-headers` (`node scripts/verify-security-headers.mjs --static-only`).
  - Confirms `next.config.ts`, `middleware.ts`, and `src/lib/security/headers.ts` conform to `src/config/security-headers-policy.json`.
  - Zero tolerance for configuration drift or undocumented headers.

- [x] **Gate 2: Automated Unit & Negative Test Suite**
  - Executed via `npm run test:security-headers:unit` (`node --test scripts/__tests__/verify-security-headers.test.mjs`).
  - Asserts that:
    - Embedding is denied (`X-Frame-Options: DENY` and `frame-ancestors 'none'`).
    - Disallowed features (`microphone`, `geolocation`, `usb`, `payment`, `display-capture`) remain closed.
    - Script evaluation bypasses (`unsafe-eval`) are absent outside local development.
    - WalletConnect (`wss://`, `https://`) and Worldcoin (`camera`) boundaries remain intact.

- [x] **Gate 3: Host & Live Deployment Verification**
  - Executed against the hosted preview or release target:
    ```bash
    node scripts/verify-security-headers.mjs --url <TARGET_URL> --env <preview|testnet|production> --report-file reports/security-headers-evidence.json
    ```
  - Confirms headers are emitted by the actual deployed server / edge host, not solely by local development middleware.

- [x] **Gate 4: Environment Evidence Sign-Off**
  - Verified JSON reports exist under `reports/`:
    - `reports/evidence-preview.json`
    - `reports/evidence-testnet.json`
    - `reports/evidence-production.json`
  - Each artifact contains verified checks, negative tests, integration validations, and a SHA-256 integrity digest.

---

## Triage & Failure Remediation Runbook

When the CI `security-headers` gate fails, consult the table below for rapid remediation:

| Failure Mode | Root Cause | Remediation |
| :--- | :--- | :--- |
| `HSTS header is missing on HTTPS endpoint` | Server / CDN proxy stripped `Strict-Transport-Security` or plaintext request tested. | Ensure target URL is HTTPS (`https://`) and verify reverse proxy / CDN passes HSTS header from `next.config.ts`. |
| `frame-ancestors must be 'none'` | Middleware CSP or reverse proxy relaxed embedding policy. | Verify `src/lib/security/headers.ts` and `src/config/security-headers-policy.json`. Do not allow framing exceptions without security review. |
| `'unsafe-eval' is forbidden in production environment` | Development flag or debugging build configuration leaked into production. | Ensure `NODE_ENV=production` and `isDevelopment` is false when compiling. |
| `Missing WalletConnect hosts in connect-src` | Origin policy modified or WalletConnect domain updated. | Update `WALLET_CONNECT_HOSTS` in `headers.ts` and canonical policy after validating security impact. |
| `Permissions-Policy grants disallowed capabilities` | An unauthorized hardware permission (e.g. microphone or location) was opened. | Revert change to `PERMISSIONS_POLICY`. Only `camera` for Worldcoin IDKit is permitted. |
| `Configuration drift detected` | `next.config.ts` or `middleware.ts` headers modified without updating canonical policy. | Align files with `src/config/security-headers-policy.json` and re-run verification. |

---

## Evidence Verification Commands

Maintainers can verify release evidence locally or in CI with the following commands:

```bash
# 1. Run unit test suite
npm run test:security-headers:unit

# 2. Check static configuration
npm run verify:security-headers

# 3. Generate canonical evidence reports for preview, testnet, and mainnet
node scripts/verify-security-headers.mjs --generate-evidence

# 4. Verify live preview URL
node scripts/verify-security-headers.mjs --url https://preview.truthbounty.io --env preview
```

