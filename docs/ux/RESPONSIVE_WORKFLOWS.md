# TruthBounty V2 Responsive Workflow Contract

**Status:** Implementation baseline (V2-FE-128)
**Approved runtime:** Optimism/EVM
**Depends on:** V2-FE-127 (canonical API and contract interfaces)

This document records the mobile-responsiveness contract for every protocol
workflow in the frontend, the rationale for each collapse rule, and the
automated coverage that keeps the contract enforceable in CI. It complements
[INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md) (which defines the
intent) and [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) (which defines tokens,
touch-target sizing and component contracts).

## Breakpoints

Tailwind default breakpoints are the single source of truth:

| Token | Width | Meaning for protocol workflows |
|---|---|---|
| base | < 640px | Phone. Single column, stacked summaries, compact labels, secondary indicators collapsed. Hamburger navigation (`lg:hidden`). |
| `sm` | ≥ 640px | Large phone / small tablet. Feed filters, theme toggle and status indicators return to the top bar. |
| `md` | ≥ 768px | Tablet. Multi-column stat grids (`grid-cols-2 md:grid-cols-3`). |
| `lg` | ≥ 1024px | Desktop. Persistent sidebar; hamburger hidden; two-column claim/action layout (`lg:grid-cols-[minmax(0,1fr)_360px]`). |
| `xl` | ≥ 1280px | Wide desktop. Full six-column stat row and dashboard action rail. |

Rules that hold at every breakpoint:

- **No horizontal page overflow.** The only permitted two-dimensional
  scrolling is inside a genuine data table's own labelled scroll region.
- **Interactive targets ≥ 44×44 CSS pixels** on touch viewports
  (`min-h-[44px]`, `touch-manipulation` on protocol actions).
- **Protocol state is never hidden to fit.** Loading, empty, stale, rejected,
  failed, pending, confirmed, finalized and reorged messaging stays visible and
  announced (`role="status"` / `role="alert"`) at every width; only
  *secondary* indicators collapse.
- **Reduced motion** is honoured globally (`prefers-reduced-motion` in
  `globals.css`).

## Workflow inventory and collapse rules

| Workflow | Routes / components | Mobile behaviour (base → `sm`) | Automated coverage |
|---|---|---|---|
| App shell / navigation | `MainLayout`, `Sidebar`, `Topbar` | Fixed hamburger reserves `pl-16` header clearance; drawer slides in with overlay, Escape closes and restores focus. Header keeps wallet + submit-claim visible; chain/time filters, theme toggle, realtime dot and trust chip render from `sm` up; left group `min-w-0`, right group `shrink-0`. | `src/__tests__/responsive/mobile-workflows.test.tsx`, `e2e/mobile-responsive.spec.ts` |
| Claims feed | `ActiveClaimsTable` | Filter chips wrap; search row goes full-width (`w-full sm:w-auto`); table lives in a `role="region"` scroll region with `tabIndex={0}` and `min-w-[640px]` so columns stay readable. | responsive + a11y suites, e2e |
| Rewards claim | `ClaimRewardsPanel` | Header stacks vertically (`flex-col sm:flex-row`); total + claim button spread across the row (`w-full … sm:w-auto`); copy truncates instead of overflowing. Disabled/empty/success/error states unchanged and announced. | responsive + a11y suites, e2e |
| Claim submission | `ClaimSubmissionForm` (modal) | Uses `.modal-shell`/`.modal-panel` (full-width ≤32rem, viewport-padded, internally scrollable); buttons side-by-side with `flex-1`. | `ClaimSubmissionForm.modal.test.tsx`, a11y modals suite, e2e (fits viewport, Escape closes) |
| Claim verification | `claims/[id]` page, `ClaimDetails`, `StakeForm`, `VerificationActions`, `TransactionStatus`, `EvidenceViewer` | Two-column layout collapses to one column below `lg`; claim title wraps (`break-words`, `flex-wrap` header) with status badge `shrink-0`; evidence URLs `break-all`; verify/reject stack with 44px targets; transaction status announces via live regions. | responsive + a11y suites, e2e (fail-closed not-found state) |
| Dispute | `MainClaimCard`, `DisputeVoting`, `OpenDispute` | Cards stack (`p-4 sm:p-6`), stake input full-width, vote buttons stay a two-column grid of ≥44px targets; modal buttons stack (`flex-col sm:flex-row`). | responsive suite, a11y modals suite |
| Transaction status | `TransactionItem`, `StatusCard`, `TransactionsList` | Header/footer wrap (`flex-wrap` + `gap-3/2`); amount and status badge `shrink-0`; hash reference `break-all`; status cards drop fixed `min-w` below `sm`. Confirming/pending/confirmed/failed labels always visible. | responsive + a11y suites |
| Identity / Worldcoin | `identity` page, `WorldcoinVerificationPanel` | Panels single-column; connected-wallet row wraps (`flex-wrap gap-3`); panel header wraps with tooltip pinned (`shrink-0`); verify button full-flow below `sm`. | responsive suite, e2e |
| Education | `how-it-works` page | Already single-column below `sm`; decorative line hidden on mobile; verified by overflow gate. | e2e |
| Dashboard overview | `StatsCards`, `ActivityAndNodes`, `VerificationNodes` | `grid-cols-2 md:grid-cols-3 xl:grid-cols-6`; chart uses `ResponsiveContainer`; node list scrolls inside its own card (`overflow-y-auto`). | existing suites + `activity-and-nodes-overflow.test.tsx` |

## Accessibility coupling

Responsive collapse and accessibility are enforced together:

- The claims-table scroll region is keyboard reachable (`tabIndex={0}`) and
  labelled, so horizontal scrolling is not mouse-only.
- Collapsed top-bar controls are removed from the layout with `hidden` (not
  `display` overridden inline), keeping the a11y tree consistent with the
  visual tree; primary actions are never `hidden` at any breakpoint.
- Transaction state changes announce through `role="status"`
  (polite) and `role="alert"` (failure) regardless of viewport.
- Every touched component passes `jest-axe` in
  `src/__tests__/accessibility/mobile-workflows.test.tsx`.

## What this contract does NOT change

- Contracts remain authoritative for protocol mutation; the API stays a
  projection/read layer. No calldata, gas, hash, confirmation, reward,
  reputation or settlement state is fabricated by layout changes.
- No alternate-chain (Stellar/Soroban/Freighter) runtime code.
- No visual redesign: changes are breakpoint-driven stacking, wrapping,
  truncation and collapse of existing elements only.
- No change to protocol terminology or content rules.

## Running the checks

```bash
pnpm lint                 # eslint (src)
pnpm type-check           # tsc --noEmit
pnpm test                 # unit + component suites (incl. responsive contracts)
pnpm test:a11y            # jest-axe suites
pnpm verify-artifacts     # canonical contract artifact drift gate
pnpm build                # production build (runs verify-artifacts via prebuild)
pnpm test:e2e             # Playwright (needs `pnpm build` first; includes e2e/mobile-responsive.spec.ts at 375×812)
```
