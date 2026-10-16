# V2-FE-128: Make Every Protocol Workflow Mobile Responsive

## Pull Request Summary

### Issue Reference

**V2-FE-128** — Make Every Protocol Workflow Mobile Responsive (Closes #401)

**Depends on:** V2-FE-127 (canonical API and contract interfaces)

---

## Overview

This task makes every protocol workflow in the TruthBounty frontend usable on
narrow (phone) viewports through breakpoint-driven stacking, wrapping,
truncation and collapse of existing elements — without any visual redesign,
and without touching protocol authority. Contracts remain authoritative for
protocol mutation; the API remains a projection/read layer. No calldata, gas,
hash, confirmation, reward, reputation or settlement state is fabricated by
any change in this PR.

The full contract (breakpoints, per-workflow collapse rules, accessibility
coupling and coverage) is documented in
[`docs/ux/RESPONSIVE_WORKFLOWS.md`](docs/ux/RESPONSIVE_WORKFLOWS.md), linked
from `docs/ux/INFORMATION_ARCHITECTURE.md`.

---

## What changed (layout)

| Workflow | File | Change |
|---|---|---|
| App shell | `src/components/layout/Topbar.tsx` | Header reserves `pl-16` clearance so the fixed mobile hamburger never covers the chain controls; left control group is shrinkable (`min-w-0`), action group is `shrink-0`; feed filters, theme toggle, realtime dot and trust chip collapse below `sm` so wallet + submit-claim always fit at 320–375px. Primary actions are never `hidden`. |
| Claims feed | `src/components/features/ActiveClaimsTable.tsx` | Search row goes full-width below `sm` (`w-full sm:w-auto`, input `min-w-0`); filter button `shrink-0`; table given `min-w-[640px]` inside a **labelled, keyboard-focusable scroll region** (`role="region"`, `tabIndex={0}`) — the documented exception for genuine data tables. |
| Rewards claim | `src/components/features/ClaimRewardsPanel.tsx` | Header stacks below `sm` (`flex-col sm:flex-row`); total + claim button spread across a full-width row on mobile; panel copy and reward titles truncate instead of overflowing; padding tightens to `px-4` below `sm`. |
| Claim verification | `src/components/features/claim-verification/ClaimDetails.tsx` | Title row wraps (`flex-wrap`, `break-words`, badge `shrink-0`); category/trust footer wraps; long evidence URLs `break-all`; section headings corrected h4→h3 (axe `heading-order`); card padding `p-4 sm:p-6`. |
| Transaction state | `src/components/features/claim-verification/TransactionStatus.tsx` | Pending/success announce via `role="status"` + `aria-live="polite"`; failure via `role="alert"`; text wraps at mobile sizes. |
| Transaction status | `src/components/transactions/transaction-item.tsx` | Header and footer wrap (`flex-wrap` + gaps) so status badge, amount, hash and actions never collide; hash reference `break-all`; decorative icons `aria-hidden`. |
| Transaction status | `src/components/transactions/status-card.tsx` | Fixed `min-w-[200px]` dropped below `sm` (`min-w-0 w-full sm:min-w-[200px]`) so cards fit narrow grids. |
| Dispute evidence | `src/components/features/claim-details/EvidenceLinks.tsx` | Rows gain `gap-3 min-w-0`; titles/descriptions truncate; View action `shrink-0`, now with `target="_blank" rel="noopener noreferrer"` and an accessible name announcing the new tab (repo convention for external links). |
| Identity | `src/app/(dashboard)/identity/page.tsx` | Connected-wallet row wraps (`flex-wrap gap-3`). |
| Identity | `src/components/features/worldcoin/WorldcoinVerificationPanel.tsx` | Panel header wraps with tooltip pinned (`shrink-0`); compact variant wraps. |

Already-responsive workflows were audited and are guarded by tests rather
than modified: claim submission modal (`.modal-shell`/`.modal-panel`),
`VerificationActions`, `StakeForm`, `DisputeVoting`, `OpenDispute`,
`MainClaimCard`, dashboard grids (`StatsCards`, `ActivityAndNodes`,
`VerificationNodes`), `how-it-works`, `TrustWarningBanner`, sidebar drawer.

## Defect fixed while testing the workflow (fail-closed correctness)

`src/app/(dashboard)/claims/[id]/page.tsx` read `params.id` from page props.
Under Next 16 async request APIs the client-side value is a Promise, so
`params.id` evaluated to `undefined` on the client, `ClaimDetails` never
fetched the API projection, and the page rendered its **"Claim Not Found"
state unconditionally** — inventing projection state for every claim id
(acceptance criterion: "UI reflects canonical chain/API state and never
invents protocol outcomes"). The page now reads the route parameter with
`useParams()` from `next/navigation`, so it queries the projection and only
fails closed when the projection genuinely returns 404.

## CI dependency repairs (pre-existing red on `main`)

The merged dependabot dev-dependency group bump (PR #427) left `npm run lint`
hard-failing on `main` (verified before any feature work):

1. `typescript ^7` → `typescript-eslint@8.70` (via `eslint-config-next`) throws
   "typescript-eslint does not support TS 7.0" at config load. **Pinned
   `typescript` back to `^5`** (5.9.3 — the exact pre-bump state; no stable
   typescript-eslint release supports TS 7 yet).
2. `eslint ^10` → `eslint-plugin-react@7.37.5` (required by
   `eslint-config-next@16.3.5`, peer range `<= ^9.7`) crashed with
   `contextOrFilename.getFilename is not a function` on every file. **Pinned
   `eslint` back to `^9`.**

Both pins are the minimal revert of the two breaking entries in that
dependabot group; `eslint-config-next` 16.3.5, `eslint-plugin-storybook` 10
and all other bumps are kept. Lint now runs with **0 errors** (49 pre-existing
warnings in untouched legacy files, unchanged).

---

## Tests added

### Unit/component — `src/__tests__/responsive/mobile-workflows.test.tsx` (24 tests)

Responsive contracts for every workflow listed above: header clearance and
collapse rules, stacking classes, truncation, scroll-region keyboard
accessibility, `aria-pressed` filters, 44px touch targets, live-region
announcements for all four transaction states, disabled/empty reward states.

### Accessibility — `src/__tests__/accessibility/mobile-workflows.test.tsx` (7 tests)

`jest-axe` on ActiveClaimsTable, ClaimRewardsPanel, ClaimDetails,
VerificationActions, TransactionStatus (all states), TransactionItem
(failed + error message) and EvidenceLinks. Fixed the real `heading-order`
violation found in ClaimDetails (h2 → h4).

### E2E — `e2e/mobile-responsive.spec.ts` (6 tests, 375×812 viewport)

- Dashboard: zero horizontal overflow; primary actions visible; collapsed
  filters; hamburger never overlaps the submit action.
- Mobile navigation: opens, Escape closes, focus restored to the hamburger.
- Submit-claim modal fits the viewport and closes with Escape.
- Claim verification route fails closed on unknown claims (documented
  not-found state + recovery) without overflow.
- Identity workflow and how-it-works guidance fit the viewport.

No test is skipped; mocks used in tests are test-only and never imported by
production bundles.

---

## Local CI evidence (all executed against this head)

| Gate | Command | Result |
|---|---|---|
| Lint | `pnpm lint` | ✅ 0 errors (49 pre-existing warnings, untouched files) |
| Type check | `pnpm type-check` | ✅ clean |
| Unit/component tests | `pnpm test` | ✅ 80 suites, **757 tests** (was 78/726) |
| Accessibility | `pnpm test:a11y` | ✅ 3 suites, 13 tests |
| Artifact drift | `pnpm verify-artifacts` | ✅ release v2.0.0-sepolia on chain 11155420 |
| Production build | `pnpm build` | ✅ compiled + TypeScript clean |
| E2E | `pnpm test:e2e` | ✅ 7/7 (Chrome channel, production server) |

---

## Acceptance criteria mapping

- ✅ **UI reflects canonical chain/API state, never invents outcomes** — claim
  detail now queries the projection (defect fixed above); layout changes
  render existing state only; fail-closed path covered by e2e.
- ✅ **All required states accessible, responsive, deterministic,
  recoverable** — loading/empty/disabled/failed/pending/success states keep
  rendering at all widths, announced via live regions; scroll region is
  keyboard reachable; mobile menu restores focus; touch targets ≥44px.
- ✅ **Required tests execute in CI and pass without concealed skips** — all
  seven gates above run green locally; new suites run under existing `pnpm
  test`, `pnpm test:a11y`, `pnpm test:e2e` scripts (already wired in CI).
- ✅ **Canonical artifacts, documentation and telemetry/redaction rules
  synchronized** — `verify-artifacts` green; new
  `docs/ux/RESPONSIVE_WORKFLOWS.md` linked from the information architecture;
  component JSDoc documents mobile behaviour; no telemetry changes.
- ✅ **No unrelated issue closed, no unrelated redesign bundled** — single
  linked issue (#401); changes are breakpoint-driven layout only.
- ⏳ **Independent maintainer approval of the exact head SHA** — required for
  merge (wallet/signature/transaction-sensitive surfaces are read-side only
  in this PR; no transaction construction logic modified).

## Non-goals (explicitly out of scope)

- Changing smart-contract or backend protocol authority.
- Adding alternate-chain (Stellar/Soroban/Freighter) runtime support.
- Unrelated product redesign or brand changes.
- Rewriting legacy hooks flagged by pre-existing lint warnings.
