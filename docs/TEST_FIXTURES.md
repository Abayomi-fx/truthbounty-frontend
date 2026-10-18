# Deterministic Test Fixtures and Canonical Scenarios

> **Document ID:** UI-FE-088
> **Linked Issue:** [#660](https://github.com/DigiNodes/truthbounty-frontend/issues/660)
> **Status:** Implementation
> **Authority:** Frontend Maintainers

This document describes the shared fixture system introduced by UI-FE-088: a
typed factory library plus a canonical scenario catalogue that Storybook, Jest,
and Playwright all consume, so ad-hoc story/test data cannot drift from the
pinned interfaces again.

---

## 1. Where everything lives

| Deliverable | Path |
|---|---|
| Deterministic primitives (clock, seed, network) | `src/testing/fixtures/deterministic.ts` |
| Typed factory library | `src/testing/fixtures/factories/` |
| Canonical scenario catalogue | `src/testing/fixtures/scenarios.ts` |
| Route-to-capability authority fixtures (UI-FE-087) | `src/testing/fixtures/authority/` |
| Barrel entry point | `src/testing/fixtures/index.ts` |
| Storybook stories | `src/testing/fixtures/scenarios.stories.tsx` |
| Playwright adapter | `e2e/support/scenarios.ts` |
| Playwright spec | `e2e/canonical-scenarios.spec.ts` |
| Jest tests | `src/testing/fixtures/__tests__/` |
| CI determinism guard | `scripts/verify-fixture-determinism.mjs` |
| Guard self-test | `scripts/__tests__/verify-fixture-determinism.test.mjs` |

Everything lives under a `fixtures/` directory (or is a `*.stories.*` /
`*.spec.*` file), which `scripts/verify-production-boundaries.mjs` treats as
test-only. **Production code must never import this path** — `prebuild` fails
the build if it does, and the `.next` bundle is scanned for the canary
`TRUTHBOUNTY_TEST_ONLY_FIXTURE_FACTORY_UI_FE_088`.

---

## 2. The determinism contract

Every factory is a **pure function of `(seed, key)`**:

- The clock is pinned to `FIXTURE_EPOCH_MS` (`2026-10-14T00:00:00.000Z`).
  Timestamps come from `ctx.isoAt(offsetMs)` — never `Date.now()` or a bare
  `new Date()`.
- Identifiers, addresses, hashes, and integers come from an FNV-1a hash of the
  seed plus an explicit key — never `Math.random()`, `crypto.randomUUID()`,
  or `performance.now()`.
- Two calls with the same arguments therefore produce structurally identical
  output, in every process, on every machine.

CI enforces this:

- `node scripts/verify-fixture-determinism.mjs` scans the fixture builders for
  nondeterministic APIs (it runs in the `artifacts` job and in `prebuild`, and
  needs no `node_modules`).
- `jest src/testing/fixtures/__tests__/determinism.test.ts` rebuilds every
  scenario twice, compares the serialised output, and snapshots the catalogue.

Need an isolated universe? Pass a different seed — still deterministic:

```ts
const ctx = createFixtureContext('viewer-b');
ctx.address('claimant:claim-0001'); // stable for this seed, distinct from the default
```

---

## 3. Using the factories

```ts
import { makeClaim, makeClaimsListEnvelope, makeTransaction } from '@/testing/fixtures';

makeClaim({ index: 1 });                      // pinned `Claim` shape
makeClaimsListEnvelope({ freshness: 'stale' }); // pinned `ClaimsListEnvelope`
makeTransaction('reverted');                    // pinned `Transaction` union
```

Each factory accepts an optional `ctx` (fixture context) and `overrides`
applied last, so a test can adjust one field without re-deriving the rest:

```ts
makeClaim({ overrides: { status: 'DISPUTED', totalStaked: 0 } });
```

Factories are grouped by domain and by *where the value comes from*:

| Module | Produces | Origin |
|---|---|---|
| `factories/releases.ts` | `ReleaseManifest`, `ProtocolDiagnostics` | contract-derived (defaults to `release/manifest.json`) |
| `factories/transactions.ts` | `Transaction`, `FinalityContext`, `FinalityResult` | contract-derived (finality is derived by the production `deriveFinalityLevel`) |
| `factories/verifications.ts` | `OnChainVerification` **and** `VerificationProjection` | contract vs. API, deliberately separate |
| `factories/claims.ts` | `Claim`, `ClaimListItem`, `ClaimsListEnvelope` | domain + API projection |
| `factories/disputes.ts` | `DisputeContext`, `DisputeTransaction`, bond/deadline/wallet | API read model |
| `factories/freshness.ts` | `ApiHealthResponse` | API projection |
| `factories/capabilities.ts` | `AppShellCapabilities`, `AppShellRoles`, `RouteAccessStatus` | app shell |
| `factories/incidents.ts` | `TelemetryEvent` (category `incident`) | telemetry |
| `factories/legal-content.ts` | `LegalContentVersion` | fixture-local type (see §6) |

---

## 4. The canonical scenario catalogue

`src/testing/fixtures/scenarios.ts` defines one named, reusable fixture per
canonical system state:

| Id | View state | What it reproduces |
|---|---|---|
| `loading` | `loading` | Read in flight; no projection yet, transaction `submitted` |
| `empty` | `empty` | Read succeeded with zero records |
| `stale` | `ready-stale` | Projection older than the 60s freshness bound |
| `denied` | `ready` | All capabilities revoked, route access fails closed |
| `offline` | `ready-stale` | Cached projection, dependencies unreachable |
| `unavailable` | `error` | Projection endpoint 503 → `PROJECTION_UNAVAILABLE` |
| `reverted` | `ready` | Receipt `0x0` — finalized but no state change |
| `replaced` | `ready` | Same-nonce replacement before inclusion (`REPLACED`) |
| `indexing-delayed` | `ready-stale` | Finalized on chain, indexer cursor lagging |
| `reorged` | `ready` | Previous receipt vanished; finality `reorged` |
| `finalized` | `ready` | Receipt below the finalized head |

```ts
import { getScenario, CANONICAL_SCENARIOS } from '@/testing/fixtures';

const scenario = getScenario('unavailable');
scenario.ui.viewState;                    // 'error'
scenario.projection.claimsListError?.code; // 'PROJECTION_UNAVAILABLE'
scenario.contract.finality.level;          // contract-derived, never a projection
```

All scenarios describe the **same** entities (`claim-0001` …) in different
states, so a state change never silently changes the data underneath it.

Every scenario is split into three buckets so contract-derived values and API
projections stay visibly distinct:

- `contract` — release manifest, transaction, finality, raw on-chain verification
- `projection` — claims list envelope, freshness, verification projections, dispute read model
- `ui` — view state, capabilities, route access, incident, legal-content version

---

## 5. Consumers

### Unit tests (Jest)

```ts
const scenario = getScenario('stale');
expect(scenario.projection.claimsList?.projection.freshness).toBe('stale');
```

### Storybook

`Testing → Canonical Scenarios` renders one story per canonical id from the
same catalogue. Because the story renders `getScenario(id)` directly, a
screenshot change always traces back to a fixture change.

### Playwright

```ts
import { stubScenarioClaimsApi } from './support/scenarios';

test('fails closed', async ({ page }) => {
  await stubScenarioClaimsApi(page, 'unavailable');
  await page.goto('/');
  await expect(page.getByTestId('claims-read-notice-error')).toBeVisible();
});
```

`stubScenarioClaimsApi` fulfils `GET /api/claims` with the scenario's own
payload and records what the browser received. The shared-definition proof
lives in `e2e/canonical-scenarios.spec.ts` and in
`src/testing/fixtures/__tests__/shared-consumers.test.ts`, which resolve all
three consumers' imports to the same file.

---

## 6. Known gaps

- **Legal-content versions** have no pinned interface in the repository yet.
  `factories/legal-content.ts` pins a minimal local `LegalContentVersion`
  shape (id, version, locale, title, summary, effectiveAt, supersededBy,
  contentDigest) and documents it as a gap. When the protocol implementation
  matrix lands a real type, re-point `makeLegalContentVersion` at it.
- **Surfaces without a rendered state yet** (for example a reorged banner on
  the dashboard) are asserted in Jest and rendered in Storybook rather than
  with brittle e2e selectors. Add a Playwright assertion when the surface
  lands, using the same scenario id.

---

## 7. Adding a new canonical state

1. Add the id to `CANONICAL_SCENARIOS` and its label/description in `scenarios.ts`.
2. Add the branch to `buildScenario()` and to `EXPECTED_VIEW_STATE` in
   `__tests__/scenario-catalogue.test.ts`.
3. Export a story (`export const MyState: Story = { args: { id: 'my-state' } }`)
   and cover the id in `shared-consumers.test.ts`.
4. Run `pnpm test`, `pnpm type-check`, and `pnpm verify:fixture-determinism`.

If the new state needs new data, add a factory under
`src/testing/fixtures/factories/` that returns a pinned interface type — never
an untyped object — and never a wall-clock read or random value.
