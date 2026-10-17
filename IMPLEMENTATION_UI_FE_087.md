# UI-FE-087 — Generate Route-to-Capability Conformance Tests From Protocol Authority

**Issue:** [#659](https://github.com/DigiNodes/truthbounty-frontend/issues/659)
**Branch:** `feat/ui-fe-087-route-capability-conformance`
**Base:** upstream `main`

## Overview

Converts the approved protocol route/capability authority into deterministic
test fixtures and executable conformance tests. The suite covers visibility,
navigation, read access, mutation controls, denied states, redirects, stale
authority, and unmapped-route drift.

Authority is pinned to `DigiNodes/truthbounty-protocol` commit
`60c66b78cf797d8f821089c99ae1bc461009fecc`.

## Files

### Capability authority

- **[ADD]** `src/testing/fixtures/authority/capability-authority.ts`
  - Six approved contexts and the complete 16-row capability matrix.
  - Ten required fixtures: anonymous, claimant, verifier, operations,
    governance, guardian, revoked, stale, wrong-chain, unavailable.
  - Fail-closed resolver: prohibited capabilities never grant; missing/stale/
    revoked/unavailable authority denies or returns unavailable.
  - Active context is presentation-only and never influences grants.

### Route authority

- **[ADD]** `src/testing/fixtures/authority/route-authority.ts`
  - All 29 canonical routes from the sitemap.
  - All 58 approved boards plus global foundation/system board refs.
  - Read rules, audiences, navigation groups, mutation controls, aliases, and
    implementation status.
  - Legacy redirects preserving query/hash.
  - Shipped-route classification table used by the filesystem inventory test.

- **[ADD]** `src/testing/fixtures/authority/index.ts`
- **[MODIFY]** `src/testing/fixtures/index.ts`

### Tests

- **[ADD]** `src/testing/fixtures/authority/__tests__/capability-matrix.test.ts`
- **[ADD]** `src/testing/fixtures/authority/__tests__/route-inventory.test.ts`
- **[ADD]** `src/testing/fixtures/authority/__tests__/route-capability-conformance.test.ts`

### Documentation

- **[ADD]** `docs/ROUTE_CAPABILITY_CONFORMANCE.md`

## Acceptance Criteria

| Criterion | Evidence |
|---|---|
| Every canonical route has explicit capability expectations | `CANONICAL_ROUTE_EXPECTATIONS` covers all 29 sitemap routes; inventory test asserts completeness |
| Selecting a UI context never grants authority | `selectActiveContext` tests prove identical capability/route decisions for every selected context |
| Missing/stale capability fails closed | `resolveCapability` and `evaluateRouteRead` deny/return unavailable for stale, wrong-chain, revoked, and unavailable fixtures |
| New routes cannot merge without authority mapping | Filesystem inventory test walks `src/app/**/page.tsx` and fails on any unclassified route |

## Verification

```text
Test Suites: 3 passed, 3 total
Tests:       37 passed, 37 total
```

Additional checks:

- `node scripts/verify-fixture-determinism.mjs` — passed
- `node scripts/verify-production-boundaries.mjs source` — passed
- Targeted TypeScript check of the authority fixtures/tests — 0 errors

Full-repo `tsc`/ESLint remain blocked by pre-existing `main` failures unrelated
to this change (broken `src/app/queries/queryKeys.ts` syntax and the
`eslint-plugin-react@7.37.5` / ESLint 10 incompatibility).

## Non-Goals

- No board redesign.
- No API/contract behavior invented.
- No runtime authority-granting code.
- No `Stellar Wave` label changes.
