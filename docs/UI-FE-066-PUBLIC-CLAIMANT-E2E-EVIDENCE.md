# UI-FE-066 — Optimism Sepolia Public and Claimant E2E Journeys

**Issue:** #639  
**Complexity:** High  
**Points:** 200  
**Branch:** `fix/ui-fe-066-optimism-sepolia-e2e`  
**Base head:** `e8eec40da0f3348bb94d050dce08de7d0324ba81` (`origin/main`)  
**Exact head:** recorded in the pull request body and `Exact head verified` line.

## 1. Summary

This change adds a deterministic end-to-end journey for the approved public and
claimant compositions on the pinned Optimism Sepolia release
(`v2.0.0-sepolia`, chain `11155420`, protocol `2.0.0`).

The journey covers:

- Public landing and claim exploration.
- Claim detail, evidence, funding, verification, and settlement.
- Claimant dashboard and claimant rewards center.
- Claim draft, evidence, review, and authorization.
- Transaction confirmation and the transaction/reload-recovery center.

Failure journeys cover wallet rejection, revert, replacement, indexing delay,
reorg, evidence outage, guest/unsupported-chain contexts, and reload recovery.

The suite runs the production components through an isolated Storybook +
Playwright harness, matching the existing `rewards-center` and
`verifier-dispute` patterns. It does not perform live OP Sepolia writes and
does not fabricate wallet, receipt, finality, permission, or settlement state.

## 2. Deliverables

| File | Purpose |
| --- | --- |
| `src/testing/public-claimant-journey/PublicClaimantJourney.tsx` | Deterministic public/claimant journey composition built from production components. |
| `src/testing/public-claimant-journey/PublicClaimantJourney.stories.tsx` | One story per protected scenario. |
| `src/testing/public-claimant-journey/css.d.ts` | CSS-module declarations for the isolated type check. |
| `.storybook/public-claimant/` | Isolated Storybook config for the journey. |
| `playwright.public-claimant.config.ts` | Playwright runner for the journey. |
| `e2e/public-claimant-journey.spec.ts` | Thirteen E2E assertions covering the required matrix. |
| `package.json` | Adds `test:e2e:public-claimant`. |

## 3. Scenario matrix

| Scenario | Story | Assertions |
| --- | --- | --- |
| Pinned release and account | `HappyPath` | Release id, protocol, chain, git commit, test account |
| Public exploration | `HappyPath` | Active claims table, status filter, search, no-wallet operation |
| Claim detail | `HappyPath`, `Reorg` | Status, bounty, total staked, evidence, verification breakdown, finalized vs confirming settlement |
| Claimant dashboard | `HappyPath` | Personal metrics, next actions, recent owned claims, claimable rewards |
| Authorization | `Guest`, `UnsupportedChain` | Guest connection notice, unsupported-chain banner, switch-chain action |
| Draft and review | `HappyPath`, `EvidenceOutage` | Prefilled canonical draft, review gate, disabled submit on evidence failure |
| Evidence outage | `EvidenceOutage` | Network failure, retry upload, integrity mismatch, choose-file-again recovery, verified state |
| Wallet rejection | `WalletRejected` | Rejected transaction, wallet rejection reason, retry recovery, failure confirmation |
| Revert | `Reverted` | Reverted transaction, contract revert reason, retry recovery |
| Replacement | `Replaced` | Replaced transaction, higher-fee replacement reason, retry recovery |
| Indexing delay | `IndexingDelay` | Confirmed transaction awaiting indexing, stale projection notice, no fabricated finality |
| Reorg | `Reorg` | Reorged transaction, reorg recovery details, partial-degradation notice, provisional settlement |
| Reload recovery | `ReloadRecovery` | Seven saved transaction references restored, recovery details, prefilled draft |
| Keyboard | `HappyPath` | Public search/filter, draft fields, review actions, confirmation actions |
| Responsive | `HappyPath` | No horizontal overflow at 375, 768, and 1440 CSS pixels |

## 4. Acceptance-criteria evidence

### 4.1 Journeys use reviewed adapters and pinned artifacts

The journey header pins `v2.0.0-sepolia`, protocol `2.0.0`, chain `11155420`,
git commit `5333c0acb9ccfb8a6a37ae76b3397d06781f0119`, and the test account
`0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E`. The page renders the production
claim table, claim-detail components, claimant dashboard, rewards center,
draft/review components, transaction status, and transaction center.

### 4.2 Confirmation is separated from indexed/finalized state

- `IndexingDelay` renders "Transaction confirmed; waiting for indexing" while the
  claimant dashboard remains stale; no paid/finalized state is inferred.
- `Reorg` removes the successful settlement rendering, shows "Confirming
  Settlement", and surfaces reorg recovery details.
- `HappyPath` distinguishes finalized settlement from the provisional case in
  `Reorg`.

### 4.3 Failures have safe recovery

- Wallet rejection, revert, and replacement expose `Retry transaction`.
- Evidence network failure exposes `Retry upload`; integrity mismatch exposes
  `Choose file again` and blocks submission.
- Guest and unsupported-chain contexts fail closed with explicit notices and an
  approved switch-chain action.
- Reload recovery restores saved references without signing, retrying, or
  resubmitting anything.

### 4.4 Evidence records commits, release, chain, and test accounts

The journey header, this document, and the pull request record the base commit,
pinned release, chain, test account, and verification commands.

## 5. Verification

### 5.1 Journey E2E

```bash
pnpm test:e2e:public-claimant
```

Result: **13 passed** (Storybook + Playwright, Chromium).

### 5.2 Targeted type check

A temporary project extending `tsconfig.json` checked the journey, stories,
config, spec, and the repaired adapter surfaces. The temporary config was
removed after the check.

```bash
npx tsc --noEmit -p tsconfig.verify-temp.json
```

Result: **no errors**.

### 5.3 Targeted component tests

```bash
pnpm test src/hooks/__tests__/useRewardsCenterData.test.tsx --runInBand
```

Result: **4 passed**.

The existing `ClaimDetailView.test.tsx` suite cannot load in this checkout:
`ClaimDetailView.tsx` imports `../forms/ErrorSummary`, which is missing from
the upstream tree. The journey therefore renders the pure claim-detail
components (`ClaimHeader`, `ClaimContent`, `ClaimVerifications`,
`ClaimSettlement`) directly.

## 6. Upstream prerequisite repairs

The current `origin/main` contains pre-existing corruption outside #639 that
blocked the claimant dashboard from loading or type-checking. The following
minimal repairs are included so the journey can run against the real
compositions:

- `src/app/queries/queryKeys.ts`: restored the unified `queryKeys` export that
  was lost during corruption, and repaired control characters in wallet/filter
  scope keys.
- `src/app/queries/queryClient.ts`: aligned the cache-persistence registration
  with the current `persistedState` API.
- `src/app/lib/persistedState.ts`: added the `query` owner classification.
- `src/app/queries/walletScope.ts`: corrected the scoped-key return type.
- `src/app/api/claims.api.ts`: restored the last valid pre-corruption version
  (the committed file was an invalid base64/binary blob).
- `src/hooks/useRewards.ts`: restored the canonical implementation (the
  committed file was empty).
- `src/components/features/claim-detail-canonical/ClaimVerifications.tsx`:
  corrected the `ClaimStatus` import.
- `src/components/ui/primitives/StakeWeightDisplay.tsx`: corrected effective
  weight parsing/formatting types.

Other pre-existing corruption remains and still blocks the full Next build
(for example the missing `claim-detail-canonical/forms/ErrorSummary` module,
truncated auth/governance components, and the invalid backslash `terms` paths).
This is not introduced by this change.

## 7. Known limitations and non-goals

- The suite is deterministic and does not perform live OP Sepolia writes. The
  pinned ABI does not expose the claim/evidence mutation entrypoints, so those
  paths remain fail-closed.
- `EvidenceUploadStep`, `ReviewStep`, and `TransactionStep` in the legacy claim
  submission wizard are still `TODO` placeholders. The journey uses the
  production claim-details step, the review/confirmation components, the
  evidence upload state machine, and the canonical transaction components. It
  does not claim that the placeholder wizard steps are implemented.
- `/claims/[id]` remains broken in the current upstream tree (undeclared imports)
  and `/verifier` remains a `WIRE 1/2/3` stub. This change exercises the approved
  compositions directly rather than inventing missing adapters or routes.
- Do not commit the two staged deletions of
  `src/app/\(dashboard\)/terms/TermsPageClient.tsx` and
  `src/app/\(dashboard\)/terms/page.tsx`. They are Windows checkout artifacts for
  paths that cannot exist on NTFS.
