# UI-FE-068 — Privileged Separation and Emergency-Control E2E Journeys

**Issue:** #640  
**Complexity:** High  
**Points:** 200  
**Branch:** `fix/ui-fe-068-privileged-separation-e2e`  
**Base head:** `e8eec40da0f3348bb94d050dce08de7d0324ba81` (`origin/main`)  
**Exact head:** recorded in the pull request body and `Exact head verified` line.

## 1. Summary

This change adds a deterministic end-to-end journey for the approved
operations, governance, and guardian compositions on the pinned Optimism
Sepolia release (`v2.0.0-sepolia`, chain `11155420`, protocol `2.0.0`).

The journey covers:

- Operations principal: bounded operational queue, health telemetry, read-only
  configuration, audit references, and exact operation confirmation.
- Governance principal: upgrade review, release verification, compatibility,
  affected operations, rollback, exact governed calls, and transaction
  lifecycle.
- Guardian principal: explicit authority boundaries and fail-closed denial of
  pause, unpause, upgrade, settlement, treasury, and role powers.
- Denied, revoked, expired, wrong-chain, stale-manifest, and
  timelock-not-ready contexts.

It replaces the stale `e2e/privileged-separation.spec.ts` that targeted
non-existent routes and wallet globals with a runnable Storybook-backed
journey.

## 2. Deliverables

| File | Purpose |
| --- | --- |
| `src/testing/privileged-separation/PrivilegedSeparationJourney.tsx` | Deterministic composition built from the production admin, audit, queue, confirmation, and upgrade-review components. |
| `src/testing/privileged-separation/PrivilegedSeparationJourney.stories.tsx` | One story per protected scenario. |
| `src/testing/privileged-separation/css.d.ts` | CSS declarations for the isolated type check. |
| `.storybook/privileged-separation/` | Isolated Storybook config. |
| `playwright.privileged-separation.config.ts` | Playwright runner for the journey. |
| `e2e/privileged-separation.spec.ts` | Eleven E2E assertions covering the required matrix. |
| `package.json` | Adds `test:e2e:privileged-separation`. |

## 3. Scenario matrix

| Scenario | Story | Assertions |
| --- | --- | --- |
| Pinned release and principal | operations, governance, guardian | Release id, protocol, chain, git commit, active principal account |
| Operations | `OperationsAuthorized` | Health, governance notices, bounded queue, read-only configuration, audit trail |
| Operation confirmation | `OperationConfirmation` | Exact operation, authority, target, consequence, audit receipt, CONFIRM gate, keyboard order |
| Retry | `OperationsAuthorized` / `Retry` | Retry item rendered unavailable and disabled |
| Denied | `Denied` | Explicit denial reason, no operational content |
| Revoked | `Revoked` | Explicit revocation reason, no operational content |
| Expired | `Expired` | Explicit expiry reason, no operational content |
| Wrong chain | `WrongChain` | Explicit pinned-release mismatch, fail closed |
| Governance | `GovernanceAuthorized` | Upgrade review, verified candidate, affected operations, rollback, governed calls, lifecycle |
| Stale manifest | `StaleManifest` | Execution blocked, verification reasons visible, no execution control |
| Timelock not ready | `TimelockNotReady` | Timelock lifecycle label, blocking reasons, governed execution blocked |
| Guardian boundaries | `GuardianAuthorized` | Pause/unpause, upgrade, treasury, and role powers explicitly denied |
| Guardian overreach | `GuardianOverreach` | Denied with explicit reason, no dangerous controls |
| Emergency pause | `EmergencyPause` | Emergency pause not exposed, governed-unpause requirements explicit |
| Cross-role leakage | All three principals | Other principals' content and controls are absent |
| Responsive | All three principals | No horizontal overflow at 375, 768, and 1440 CSS pixels |

## 4. Acceptance-criteria evidence

### 4.1 Operations, governance, and guardian powers remain distinct

The operations, governance, and guardian stories render separate context
containers (`operations-context`, `governance-context`, `guardian-context`).
The cross-role leakage test asserts that each story contains only its own
principal context and none of the other principals' controls or headings.

### 4.2 Guardian cannot unpause, upgrade, settle, move treasury, or administer roles

`GuardianAuthorized` renders the explicit guardian authority boundary card and
no controls. The test asserts that no button matching
`pause|unpause|withdraw|grant|revoke|settle|upgrade` exists.
`GuardianOverreach` and `EmergencyPause` terminate with explicit denial reasons
and the same negative-control assertion.

### 4.3 Missing or stale authority fails closed

Denied, revoked, expired, wrong-chain, stale-manifest, and timelock-not-ready
stories render explicit denial/blocked states. The operation queue, audit,
health, and configuration content is absent in denied/revoked/expired/
wrong-chain contexts. Stale verification and lifecycle gates block governed
execution and never expose an execute control.

### 4.4 Mutations display exact target, operation, and lifecycle

`OperationConfirmModal` renders the exact operation title, required authority,
risk, target resource, consequence, audit-receipt statement, and a typed
`CONFIRM` gate. `GovernedUnpauseReview` renders the exact governed call
(`TimelockController#executeProposal`), the current transaction lifecycle, and
lifecycle blocking reasons.

## 5. Verification

### 5.1 Journey E2E

```bash
pnpm test:e2e:privileged-separation
```

Result: **11 passed** (Storybook + Playwright, Chromium).

### 5.2 Existing upgrade-review tests

```bash
pnpm test src/components/features/upgrade-review/__tests__/UpgradeReview.test.tsx --runInBand
```

Result: **7 passed**.

### 5.3 Targeted type check

A temporary project extending `tsconfig.json` checked the journey, stories,
config, spec, and repaired surfaces. The temporary config was removed after the
check.

```bash
npx tsc --noEmit -p tsconfig.priv-temp.json
```

Result: **no errors**.

## 6. Prerequisite repairs

The current upstream tree contains pre-existing corruption that blocked the
privileged compositions from parsing or type-checking. Minimal repairs included
in this change:

- `src/components/features/admin-dashboard/OperationalQueueTable.tsx`:
  removed an extra `)` that broke the JSX queue map.
- `src/components/features/upgrade-review/UpgradeReview.tsx`: corrected
  nullable snapshot narrowing and readonly collection props.
- `src/components/features/upgrade-review/AffectedOperationsReview.tsx`:
  accepted readonly affected operations.
- `src/components/features/upgrade-review/GovernedUnpauseReview.tsx`: accepted
  readonly governed calls.
- `src/lib/contracts/contract-evolution.ts`: corrected the
  `STALE_RECONMILIATION` error-code typo.
- Shared adapter repairs required by the component graph:
  `src/app/queries/queryKeys.ts`, `src/app/queries/queryClient.ts`,
  `src/app/lib/persistedState.ts`, `src/app/queries/walletScope.ts`, and
  `src/components/ui/primitives/StakeWeightDisplay.tsx`.

## 7. Known limitations and non-goals

- The suite is deterministic and does not perform live OP Sepolia writes. The
  pinned ABI does not expose emergency pause/unpause mutation entrypoints, so
  those paths remain fail-closed.
- The legacy `AdminDashboard` composition still imports missing
  `FormErrorSummary` modules in this upstream tree. The journey therefore
  renders the approved sub-compositions (queue, audit, health, notices,
  read-only configuration, confirmation) directly. It does not claim the
  missing module is implemented.
- Role-administration components in `src/components/features/governance-roles`
  are truncated in the upstream tree. Guardian role boundaries are asserted
  through the explicit authority boundary card and negative-control checks
  rather than invented role UI.
- Do not commit the two staged deletions of
  `src/app/\(dashboard\)/terms/TermsPageClient.tsx` and
  `src/app/\(dashboard\)/terms/page.tsx`. They are Windows checkout artifacts
  for paths that cannot exist on NTFS.
