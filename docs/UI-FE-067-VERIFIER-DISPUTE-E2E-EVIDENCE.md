# UI-FE-067 — Optimism Sepolia Verifier and Dispute E2E Journeys

**Issue:** #638  
**Complexity:** High  
**Points:** 200  
**Branch:** `fix/ui-fe-067-optimism-sepolia-e2e`  
**Base head:** `7ff2d7ee2d5647d44bbae173851b1c6a65fb1774` (`origin/main`)  
**Patch state at verification:** working-tree changes on the branch above. Record the final commit SHA in the PR before merge.

## 1. Summary

This change adds a deterministic, CI-runnable E2E journey for the approved
verifier and dispute compositions on the pinned Optimism Sepolia release
(`v2.0.0-sepolia`, chain `11155420`, protocol `2.0.0`).

The journey drives the production components directly:

- `VerifierDashboard` and its queue, phase, reward, and outcome panels.
- `DisputeEntryForm` and its contract-derived eligibility notice.
- `AppealRoundProgression`.
- `SettlementStatusPanel`.
- `TransactionStatus`.
- `StakeWeightDisplay` for effective weight.

It also closes two UI gaps needed for the issue's acceptance criteria:

1. **Pre-reveal privacy:** protected evidence and protected choice are now
   rendered only in the `reveal` or `closed` phase. During `commit` the UI
   renders an explicit sealed state even if the caller supplies the values.
2. **Canonical economics:** the eligible dispute notice now displays the exact
   contract-required bond in wei alongside the canonical window end and
   observed block.

## 2. Deliverables

| File | Purpose |
| --- | --- |
| `src/features/verifier-dashboard/types.ts` | Adds explicit missed-reveal, wrong-salt, replaced, slashed, refunded, and tied queue states. |
| `src/features/verifier-dashboard/QueuePanel.tsx` | Enforces pre-reveal privacy and renders the new states. |
| `src/components/features/disputes/DisputeEligibilityNotice.tsx` | Shows the exact required bond for eligible disputes. |
| `src/components/ui/primitives/StakeWeightDisplay.tsx` | Corrects pre-existing type errors in effective-weight formatting. |
| `src/app/queries/queryClient.ts` | Removes an invalid `type` modifier inside `import type` so the Jest transformer can load it. |
| `src/testing/verifier-dispute-journey/VerifierDisputeJourney.tsx` | Deterministic journey composition built from production components. |
| `src/testing/verifier-dispute-journey/VerifierDisputeJourney.stories.tsx` | One story per required scenario. |
| `.storybook/verifier-dispute/` | Isolated Storybook config for the journey. |
| `playwright.verifier-dispute.config.ts` | Playwright runner for the Storybook build. |
| `e2e/verifier-dispute-journey.spec.ts` | Twelve E2E assertions covering the required matrix. |
| `package.json` | Adds `test:e2e:verifier-dispute`. |

## 3. Scenario matrix

| Scenario | Story | Assertions |
| --- | --- | --- |
| Pinned release, deadlines, economics | `EligibleCommit` | Release id, chain, protocol, canonical deadline, exact bond, weight values |
| Eligible verifier | `EligibleCommit` | Eligible notice, queue item visible |
| Ineligible verifier | `Ineligible` | Fail-closed notice, work hidden |
| Commit-phase privacy | `EligibleCommit` | Protected choice/evidence absent from the DOM, sealed copy shown |
| Reveal phase | `RevealOpen` | Protected choice/evidence visible, phase reported as `reveal` |
| Missed reveal | `MissedReveal` | Explicit state and outcome, reverted transaction with recovery |
| Wrong salt | `WrongSalt` | Explicit state and outcome, terminal error |
| Replacement | `Replaced` | Explicit state and outcome, retry offered |
| Slash | `Slashed` | Explicit state and outcome, no success |
| Tie/refund | `TieRefund` | Explicit tie outcome, refund payout, settled status |
| Expired dispute | `ExpiredDispute` | `expired-window` notice, submit disabled, explicit explanation |
| Indexing delay | `IndexingDelay` | Indexing status, settlement still confirming, no paid/success state |
| Reorg | `Reorg` | Success removed, reorged status, retry and stale-round refresh |
| Appeal open | `AppealOpen` | Active round, pending appeal settlement |
| Appeal resolved | `AppealResolved` | Settled round, appeal-settled payout, resolved outcome |
| Keyboard | `EligibleCommit` | Reason, evidence remove, evidence input, and submit are reachable in order |
| Responsive | `EligibleCommit` | No horizontal overflow at 375, 768, and 1440 CSS pixels |

## 4. Acceptance-criteria evidence

### 4.1 Protected choices cannot be inferred before reveal

The commit story supplies `protectedEvidence` and `protectedChoice` to the
component, but the rendered DOM contains neither value. The only visible copy is
the sealed message. The Playwright assertion checks the entire `body` text, not
just a component subtree.

### 4.2 Deadlines and economics are canonical

The journey uses one fixed release from `release/manifest.json` and fixed
deadline, bond, quorum, and weight values. The spec asserts the rendered
deadline (`2026-10-14T12:00:00.000Z`), the required bond
(`250000000000000000` wei), and the effective supporting/quorum weights.

### 4.3 Provisional and final outcomes remain distinct

- Indexing delay: settlement badge is `Confirming` and explicitly says
  "awaiting finality"; no `Paid` state is present.
- Tie/refund and appeal resolution: settlement is final and shows its payout.
- Reorg: the previously successful state is removed and the settlement badge is
  `Reorged`.

### 4.4 Every failure path recovers or terminates explicitly

- Missed reveal and reorg expose a retry action.
- Wrong salt is terminal and does not offer a fabricated recovery.
- Expired dispute keeps the mutation disabled and states the closing time.
- Stale appeal round exposes `Refresh round` and blocks stale-round writes.
- Ineligible verifier hides queue work rather than showing inferred data.

## 5. Verification

### 5.1 Journey E2E

```bash
pnpm test:e2e:verifier-dispute
```

Result: **12 passed** (Storybook + Playwright, Chromium).

### 5.2 Component tests

```bash
pnpm test \
  src/features/verifier-dashboard/__tests__/VerifierDashboard.test.tsx \
  src/components/features/disputes/__tests__/DisputeEntryForm.test.tsx \
  src/components/features/disputes/__tests__/DisputeEntryComposition.test.tsx \
  src/components/features/appeals/__tests__/AppealRoundProgression.test.tsx \
  src/components/features/settlement/__tests__/SettlementStatusPanel.test.tsx \
  --runInBand
```

Result: **52 passed**.

```bash
pnpm test src/components/ui/primitives/__tests__/StakeWeightDisplay.test.tsx --runInBand
```

Result: **19 passed**.

### 5.3 Targeted type check

A temporary project extending `tsconfig.json` was used to check the changed
surface only (the repository-wide type check currently fails on pre-existing
upstream corruption outside this issue). The temporary config was removed after
the check.

```bash
npx tsc --noEmit -p tsconfig.verify-temp.json
```

Result: **no errors** for the changed components, journey, stories, and spec.

## 6. Upstream build blocker (pre-existing, not introduced here)

The current `origin/main` tree is corrupted in files unrelated to #638. A full
`pnpm type-check`, `pnpm build`, or `pnpm start` therefore cannot pass on this
checkout yet. Examples confirmed from the upstream raw files:

- `src/app/api/claims.api.ts` is a base64 blob rather than TypeScript.
- `src/app/queries/queryKeys.ts` drops `[` before array literals and contains
  control characters.
- `src/app/(dashboard)/claims/[id]/error.tsx` has `error=error` instead of
  `error={error}`.
- `src/components/auth/SiweSessionPanel.tsx` is truncated mid-expression.
- Several `src/components/features/governance-roles/*` files are truncated at
  31–32 lines and are not imported by any route.

These files were not modified except for the one-line `queryClient.ts` import
fix needed by the Jest transformer. The journey suite intentionally runs against
the actual production compositions through Storybook/Vite, which is the same
pattern already used by `playwright.rewards-center.config.ts`.

**Do not commit** the two staged deletions of
`src/app/\(dashboard\)/terms/TermsPageClient.tsx` and
`src/app/\(dashboard\)/terms/page.tsx`. They are Windows checkout artifacts for
paths that cannot exist on NTFS.

## 7. Non-goals and remaining work

- This suite is deterministic. It does not perform live OP Sepolia writes and
  does not fabricate wallet, receipt, or finality state.
- The pinned release ABI does not expose `openDispute`, `participateInAppeal`,
  `submitVerification`, or `submitEvidence`, so those mutation paths remain
  fail-closed in the product.
- `VerifierDashboardContainer` is still a `WIRE 1/2/3` stub and `/disputes`
  remains a read-only projection viewer. This issue runs the approved
  compositions; it does not invent missing backend or contract interfaces.
- Commit/reveal mutation UI does not exist yet. The journey covers the commit
  and reveal phases, privacy gating, and the explicit missed-reveal and
  wrong-salt outcomes as presentational states.
- A maintainer-run live OP Sepolia execution remains a separate step until the
  upstream corruption is repaired and the mutation entrypoints are pinned.
