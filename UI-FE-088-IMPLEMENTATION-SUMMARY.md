# UI-FE-088 Implementation Summary

## Issue Resolution: Deterministic Frontend Test-Data Factories and Canonical Scenario Fixtures

**Issue Number:** #660
**Complexity:** High
**Points:** 200
**Deliverables:** Typed factory library · canonical scenario catalogue · Storybook and Playwright adapters · CI determinism check · usage documentation

## Overview

The frontend had no single deterministic fixture system: Storybook args, Jest
helpers (`src/hooks/__tests__/claim-list-fixtures.ts`) and Playwright data
(`e2e/support/claims.ts`) were three hand-written copies of the same protocol
state. This implementation adds one typed, seeded factory library plus a
catalogue of the eleven canonical system states, and points all three consumers
at it.

Everything lives under a `fixtures/` path, which the existing production
boundary gate already treats as test-only, so no fixture code can reach the
production bundle.

## Files Created

### 1. Deterministic primitives — `src/testing/fixtures/deterministic.ts`

- Pinned clock `FIXTURE_EPOCH_MS` (`2026-10-14T00:00:00.000Z`); timestamps come
  from `ctx.isoAt(offsetMs)`.
- Ids, addresses, hashes and integers derived from an FNV-1a hash of
  `(seed, key)` — no RNG stream, no wall-clock reads.
- Pinned network context (`chainId 11155420`, Optimism Sepolia).
- Bundle canary `TRUTHBOUNTY_TEST_ONLY_FIXTURE_FACTORY_UI_FE_088`.

### 2. Typed factory library — `src/testing/fixtures/factories/`

| Module | Pinned types produced |
|---|---|
| `claims.ts` | `Claim`, `ClaimListItem`, `ClaimsListEnvelope` |
| `evidence.ts` | `Evidence`, `EvidenceType` |
| `verifications.ts` | `Verification`, `VerificationProjection`, `OnChainVerification` |
| `disputes.ts` | `ProvisionalOutcome`, `DisputeDeadline`, `ChallengeBond`, `DisputeWalletPosition`, `DisputeContext`, `DisputeTransaction`, `DisputeSubmissionPayload` |
| `transactions.ts` | `Transaction` (submitted → indexed, reverted, replaced), `FinalityContext`, `FinalityResult` |
| `releases.ts` | `ReleaseManifest`, `ProtocolDiagnostics` (defaults to the pinned `release/manifest.json`) |
| `capabilities.ts` | `AppShellCapabilities`, `AppShellRoles`, `RouteAccessStatus` |
| `incidents.ts` | `TelemetryEvent` (category `incident`) |
| `legal-content.ts` | `LegalContentVersion` (fixture-local; see gaps) |
| `freshness.ts` | `ApiHealthResponse`, `DependencyHealth`, `DegradedStateMetadata` |

Finality fixtures are **derived** with the production `deriveFinalityLevel`, so
a fixture cannot claim a level the canonical derivation would reject.

### 3. Canonical scenario catalogue — `src/testing/fixtures/scenarios.ts`

Eleven named scenarios, each split into `contract` (release, transaction,
finality, raw on-chain verification), `projection` (claims list, freshness,
verification projections, dispute read model) and `ui` (view state,
capabilities, route access, incident, legal content) so contract-derived values
and API projections stay visibly distinct.

`loading`, `empty`, `stale`, `denied`, `offline`, `unavailable`, `reverted`,
`replaced`, `indexing-delayed`, `reorged`, `finalized` — all describing the same
entities (`claim-0001` …) in different states.

### 4. Consumers

- **Storybook:** `src/testing/fixtures/scenarios.stories.tsx` — `Testing/Canonical Scenarios`, one story per canonical id.
- **Playwright adapter:** `e2e/support/scenarios.ts` — `stubScenarioClaimsApi(page, id)` fulfils `GET /api/claims` from the scenario and records what the browser received.
- **Playwright spec:** `e2e/canonical-scenarios.spec.ts` — 7 tests (catalogue invariants, shared-definition proof, payload delivery, loading/failure/empty states).

### 5. CI determinism check and tests

- `scripts/verify-fixture-determinism.mjs` — dependency-free scanner that fails on `Math.random`, `Date.now`, bare `new Date()`, `performance.now`, `process.hrtime`, `crypto.randomUUID`, `crypto.getRandomValues`, `randomBytes` in fixture builders, and requires the pinned clock and canary exports. Wired into `prebuild` and the CI `artifacts` job.
- `scripts/__tests__/verify-fixture-determinism.test.mjs` — 4 `node:test` cases (clean pass, four violation classes, missing clock, missing library).
- `src/testing/fixtures/__tests__/` — `determinism.test.ts` (identity + snapshots), `scenario-catalogue.test.ts` (coverage, pinned-type guards, contract/projection separation, no secret-like strings), `shared-consumers.test.ts` (all three consumers resolve to the same module), `production-boundaries.test.ts` (no production import of fixtures).
- `scripts/verify-production-boundaries.mjs` — fixture canary added to `TEST_ONLY_BUNDLE_MARKERS`.

### 6. Documentation

- `docs/TEST_FIXTURES.md` — usage, determinism contract, catalogue table, consumer examples, gaps, extension checklist.
- `docs/TEST_BOUNDARIES.md` — pointer to the fixture path and the determinism guard.

## Acceptance Criteria

| Criterion | Status | Evidence |
|---|---|---|
| Every canonical system state has a named reusable fixture | Met | `CANONICAL_SCENARIOS` (11 ids) + `getScenario(id)`; catalogue test asserts order, labels, view states |
| Identical inputs generate identical outputs | Met | `determinism.test.ts`: `buildScenario(id)` twice → deep-equal and identical serialisation; guard bans nondeterministic APIs |
| Fixture drift fails CI when pinned interfaces change | Met | Factories return pinned types (compile-time), snapshots pin output, `tsc --noEmit` reports **0 errors in `src/testing/**` and `e2e/**`** |
| No fixture module is bundled into production | Met | `fixtures/` is a test-only segment for ESLint + `verify-production-boundaries` (source and `.next` canary); `production-boundaries.test.ts` asserts it in the unit suite |
| Fixtures encode no secrets or credentials | Met | Deterministic reserved hosts only (`evidence.example.test`); catalogue test asserts no secret-like strings and an allow-listed host set |
| Contract-derived values vs API projections visibly distinct | Met | `contract` / `projection` buckets; assertions that neither bucket carries the other's keys |
| Type-check fixture builders against pinned adapters | Met | `tsc --noEmit` clean for all new files |
| Snapshot deterministic output | Met | 2 snapshots (full catalogue + one scenario) |
| Prove Storybook and Playwright consume the same definitions | Met | `shared-consumers.test.ts` resolves all three imports to `src/testing/fixtures/scenarios`; the same check runs inside the Playwright spec |
| CI guard against nondeterministic clocks/random IDs | Met | `scripts/verify-fixture-determinism.mjs` + CI step + 4 guard tests |

## Verification Log

Run locally on Windows (Node 22.18, pnpm 10.22, ESLint 10.11, TypeScript 6.0.3):

| Command | Result |
|---|---|
| `npx jest src/testing` (4 suites) | **PASS** — 27 tests, 2 snapshots |
| `node scripts/verify-fixture-determinism.mjs` | **PASS** (exit 0) |
| `node --test scripts/__tests__/verify-fixture-determinism.test.mjs` | **PASS** — 4/4 |
| `npx tsc --noEmit` | 13 errors, **none in `src/testing/**` or `e2e/**`** — see blockers |
| `npx playwright test --list` | **PASS** — 116 tests / 11 files, including all 7 new tests |
| `npx storybook build -c <fixtures-only config>` | **PASS** — `Testing/Canonical Scenarios` with 11 stories emitted |
| `npx storybook build` (whole repo) | Fails on 2 pre-existing missing exports — see blockers |
| Full `jest` run (301 test files) | As last observed: **239 suites passing, 54 failing** — every failure is in a pre-existing module (`formatLocalDateTime`, `formatRelativeAge`, `getPaginationWindow`, `useRewards`, `useWriteContract` missing or not exported) and **none under `src/testing/`**; the new fixture suites pass inside the same run |
| `npx eslint src` | Cannot run — see blockers |
| `npx playwright test` (execution) | Not runnable locally (needs a production build and a real WalletConnect project id) |

## Pre-existing Blockers Observed on `main` (not caused by this change)

These were reproduced against untouched files and are reported rather than
silently repaired, because they are outside UI-FE-088's scope:

1. **Broken lockfile.** `pnpm install --frozen-lockfile` aborts with
   `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY: no entry for 'typescript@7.0.2'`. The
   CI `lint`, `test`, `a11y`, `accessibility` and `e2e` jobs all start with that
   command. (Local work used `--no-frozen-lockfile`; `pnpm-lock.yaml` is
   restored to `HEAD` and unmodified in this change.)
2. **Type-check failures in three unrelated files** — `src/components/features/claim-detail-canonical/ClaimContent.tsx` (two sibling elements under one conditional), `src/components/features/claim-details/TimelineOfEvents.tsx` (unclosed `<div>`, missing `useMemo` import, undefined `getStatusIcon`), `src/hooks/__tests__/useTelemetry.test.ts` (JSX in a `.ts` file).
3. **ESLint cannot start.** The flat config applies `jsx-a11y` rules in objects that do not register the plugin, so ESLint 10 reports `could not find plugin "jsx-a11y"` for any file, including untouched directories; registering the plugin in the same object instead throws `Cannot redefine plugin "jsx-a11y"` (next's config already registers it), and a reduced config hits a separate `eslint-plugin-react@7.37.5` incompatibility (`contextOrFilename.getFilename is not a function`). No lint signal was obtainable in this environment.
4. **Storybook build fails repo-wide** on `SafeTreasuryWithdrawal.interaction.stories.tsx` (imports `SafeTreasuryWithdrawalPanel`, not exported) and `src/hooks/useClaimantDashboardData.ts` (imports `useRewards`, not exported from `@/hooks/useRewards`). A fixtures-only Storybook build passes.
5. **Windows-only Jest quirk.** The repository's `testMatch` entries are prefixed with `<rootDir>/`, which micromatch does not match against Windows paths, so `jest` reports "No tests found" locally. CI (Linux) is unaffected. Local runs used equivalent relative patterns: `--testMatch='**/__tests__/**/*.test.[jt]s?(x)'`.

## Non-goals Respected

- No backend mutation is mocked: the Playwright adapter fulfils read paths only and falls back (`route.fallback()`) for non-GET requests.
- Contract/API integration tests are untouched; existing ad-hoc fixtures were left in place rather than deleted.

## Usage

See [`docs/TEST_FIXTURES.md`](docs/TEST_FIXTURES.md). Quick start:

```ts
import { getScenario } from '@/testing/fixtures';

const scenario = getScenario('unavailable');
scenario.ui.viewState;                     // 'error'
scenario.projection.claimsListError?.code; // 'PROJECTION_UNAVAILABLE'
```

```ts
// Playwright
await stubScenarioClaimsApi(page, 'unavailable');
await page.goto('/');
await expect(page.getByTestId('claims-read-notice-error')).toBeVisible();
```

## Known Gaps

- **Legal-content versions** have no pinned interface in the repository. A
  minimal local `LegalContentVersion` shape is pinned in
  `factories/legal-content.ts` and documented as a gap for maintainers to
  re-point when the protocol implementation matrix lands a real type.
- States whose surfaces are not rendered on a page yet (`reorged`, `replaced`,
  `indexing-delayed`) are covered by Jest and Storybook; add Playwright
  assertions with the same scenario ids once those surfaces ship.
