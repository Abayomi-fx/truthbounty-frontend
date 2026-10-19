# Design Document — UI-FE-010: Canonical Claim Detail Composition

## Overview

This document describes the technical design for the `/claims/[claimId]` canonical detail page. The composition reconciles contract-authoritative state with freshness-labelled API projection state across seven visual regions, enforcing explicit source integrity at every data field. No fabricated protocol state, no colour-only signals, no untrusted URIs outside the `SafeExternalLink` + `evidence-sanitizer` pipeline.

The design reuses all existing project primitives and security boundaries without modification. New files introduced are pure composition: they orchestrate existing hooks, components, and boundaries rather than duplicating logic.

---

## Architecture

### File Layout

```
src/
  app/
    (dashboard)/
      claims/
        [claimId]/            ← rename from [id]; canonical param name
          page.tsx            ← Next.js App Router page (thin shell)
          error.tsx           ← already exists; keep as-is
  components/
    features/
      claim-detail/           ← new feature directory
        ClaimDetailComposer.tsx
        ClaimHeader.tsx
        EconomicSummaryPanel.tsx
        EvidenceRegion.tsx
        VerificationAggregationPanel.tsx
        ActionRail.tsx
        SettlementRegion.tsx
        ProvenanceFooter.tsx
        SourceBadge.tsx
        FreshnessLabel.tsx
        index.ts
        __tests__/
          ClaimDetailComposer.test.tsx
          ClaimHeader.test.tsx
          EconomicSummaryPanel.test.tsx
          EvidenceRegion.test.tsx
          VerificationAggregationPanel.test.tsx
          ActionRail.test.tsx
          SettlementRegion.test.tsx
          ProvenanceFooter.test.tsx
  stories/
    claim-detail/
      ClaimDetailComposer.stories.tsx
```

> **Note on existing route**: `src/app/(dashboard)/claims/[id]/page.tsx` exists as a verification-focused page. The new `/claims/[claimId]` canonical route uses the parameter name `claimId` for consistency with hooks and types. The existing `[id]` route is left untouched; `/claim-detail/` stub page is superseded.

---

## Component Hierarchy

```
page.tsx  (server component shell, reads params.claimId)
└── ClaimDetailComposer  (client, receives claimId prop)
    ├── IntegrityBoundary          (chain gate — wraps entire composer)
    ├── ClaimDetailsSkeleton       (loading state, aria-busy)
    ├── [not-found state]          (role="alert", back link to /claims)
    ├── [error/FallbackBoundary]   (role="alert", retry)
    └── [content layout]
        ├── ClaimHeader
        ├── EconomicSummaryPanel
        ├── EvidenceRegion
        ├── VerificationAggregationPanel
        ├── ProtocolContractBoundary
        │   └── ActionRail
        ├── SettlementRegion
        └── ProvenanceFooter
```

---

## Data Flow

### Hooks Consumed

| Hook | Used by | Purpose |
|---|---|---|
| `useClaimLifecycleTimeline` | Composer, SettlementRegion | Phase, events, staleness, reconcile |
| `useWriteReadiness` | ActionRail | Write gate (chain, wallet, allowance) |
| `useReorgReconciliation` | ActionRail | Reorg detection |
| `useWebSocket` | EvidenceRegion | Real-time evidence additions |
| `useReducedMotion` | Composer | `prefers-reduced-motion` |
| `useNetworkStatus` | Composer | Offline/degraded banner |

### State Reconciliation Contract

```
ClaimDetailComposer
  ↓ claimId
  useClaimLifecycleTimeline  →  { timeline, isLoading, isError, isStale, reconcile }
  
  phase ─────────────────────→  ClaimHeader (Phase_Badge)
  phase ─────────────────────→  SettlementRegion (provisional qualifier gate)
  timeline.events ───────────→  VerificationAggregationPanel (dispute events)
  
  API projection (separate query per region)
    claimDetail ───────────→  ClaimHeader (statement, dataUpdatedAt)
    claimDetail ───────────→  EconomicSummaryPanel (bounty, staked, deadlines)
    claimDetail.evidence ──→  EvidenceRegion (evidence array)
    aggregation ───────────→  VerificationAggregationPanel (counts, stakes)
    freshness ─────────────→  ProvenanceFooter (/api/freshness)
```

### Source Authority Rules

| Data | Source | Badge label |
|---|---|---|
| On-chain bounty amount | Contract read via release artifact | `contract` |
| Lifecycle phase | `useClaimLifecycleTimeline` → chain event | `contract` |
| Verification deadline | API projection | `projected` |
| Aggregation counts/stakes | API projection | `projected` |
| Evidence list | API projection | `projected` |
| Protocol fee / bond params | `EconomicRiskDisclosure` via `ProtocolContractBoundary` | `contract` |
| Settlement outcome (SETTLED/APPEAL_SETTLED) | API projection | `projected` + `"provisional"` qualifier |
| Settlement outcome (FINALIZED) | Contract read confirms | `contract` |

---

## Component Designs

### `ClaimDetailComposer`

Root composition. Owns the master loading/error/not-found branching logic.

```tsx
interface ClaimDetailComposerProps {
  claimId: string;
}
```

**State machine (simplified):**

```
idle → loading → { not-found | error | content }
content → stale (when projection exceeds staleTime)
content → failed (on unrecoverable fetch error)
```

**Rendering rules:**
- `loading` → `<ClaimDetailsSkeleton role="status" aria-busy="true" />`
- `not-found` → `role="alert"` heading "Claim not found" + `<Link href="/claims">` back link
- `failed` → `<FallbackBoundary role="alert">` with retry `<button>`; no fabricated fields
- `stale` → `<ApiStaleBanner>` across all data regions; all write actions gated
- `content` → full region tree in document order

**Focus management:**
- On transition to `failed` or `reorged`: `errorHeadingRef.current?.focus()`
- All other state transitions: announce via `aria-live="polite"` region only

**Responsive layout (Tailwind):**
```
mobile  (<768px):  single-column flex-col; ActionRail pinned near top
tablet  (768–1279px): grid-cols-2 for header/action pair
desktop (≥1280px): grid-cols-[minmax(0,1fr)_360px_300px]
                   col 1: header + economic + evidence + aggregation + settlement
                   col 2: ActionRail (sticky)
                   col 3: ProvenanceFooter + timeline summary
```

---

### `SourceBadge`

Shared primitive used by all regions. Single source of truth for the atomic label+colour swap.

```tsx
interface SourceBadgeProps {
  source: 'contract' | 'projected' | 'stale projection';
  asOf: string;        // ISO timestamp or block number string
  className?: string;
}
```

**Atomicity guarantee:** `source` and tone are derived from the same prop in the same render. There is no intermediate state — the consumer passes `source="stale projection"` and the badge renders both the text and the `stale` colour token in one pass.

**Icon glyphs:**
- `contract`: chain-link icon (`aria-hidden="true"`)
- `projected`: broadcast icon (`aria-hidden="true"`)
- `stale projection`: warning triangle icon (`aria-hidden="true"`)

**Accessible name:** `aria-label={`${source} — as of ${asOf}`}`

---

### `FreshnessLabel`

```tsx
interface FreshnessLabelProps {
  dataUpdatedAt: number;   // Unix ms from React Query
  isStale: boolean;
}
```

Renders `"Updated X ago"` with `role="status"`. When stale, applies `text-semantic-stale` token.

---

### `ClaimHeader`

```tsx
interface ClaimHeaderProps {
  claimId: string;
  statement: string;
  phase: TimelinePhase;
  dataUpdatedAt: number;
  isStale: boolean;
  onReconcile: () => void;
}
```

**Phase badge logic:**
- Text: `formatPhase(phase)` — same helper already in `ClaimLifecycleTimeline`
- `SETTLED` | `APPEAL_SETTLED`: append `" (provisional)"` in a `<span>` next to the badge; `aria-label` includes qualifier
- `FINALIZED`: apply `text-semantic-finalized` token; render accessible confirmation `<span>`
- `STALE`: apply `text-semantic-stale`; render `role="status"` region + reconcile `<button>`
- `ERROR`: render `role="alert"` region with recovery `<button>`

Icon glyphs come from the same `getPhaseConfig` map already defined in `ClaimLifecycleTimeline`. Duplicate the map into a shared `lib/phase-config.ts` so both components import from one place.

---

### `EconomicSummaryPanel`

```tsx
interface EconomicSummaryPanelProps {
  claimId: string;
  chainId: number;
}
```

Data sourced from a single `useQuery` for the claim projection. Bounty and total-staked use the `TokenAmount` primitive with `fontVariantNumeric: "tabular-nums"`. Token address is read from the release artifact (same pattern as `EconomicRiskDisclosure`).

**Deadline logic:**
- `deadline > Date.now()`: render `<TimeRemainingNotice>` with `FreshnessLabel` + `projected` `SourceBadge`
- `deadline <= Date.now()`: render `"Closed"` text; no countdown, no negative value

**Unavailable values:** `"—"` wrapped in `<span title="<reason>">` — never `0`, never fabricated.

**Loading:** wrap data rows in skeleton placeholders with `aria-busy="true"` on the container.

---

### `EvidenceRegion`

```tsx
interface EvidenceRegionProps {
  claimId: string;
  dataUpdatedAt: number;
  isStale: boolean;
}
```

**Evidence array flow:**
1. Receive `evidence[]` from API projection query
2. For each item: run `safeUrl(item.uri)` from `evidence-sanitizer`
3. Filter to items where `safeUrl` returns `{ ok: true }`
4. Render filtered list via `SafeExternalLink`; silently omit blocked items
5. If filtered list is empty → show empty-state: "No verifiable evidence is available for this claim."

**"Opens in new tab" annotation:** visible `<span className="sr-only">(opens in new tab)</span>` inside each link; `aria-label` on the `SafeExternalLink` includes the annotation.

**Image/video items:** render via `SafeExternalLink`; `alt` sourced from `item.description`; if absent, use `"Evidence item [n]"`.

**No `dangerouslySetInnerHTML` anywhere in this region.**

**WebSocket updates:** `useWebSocket` subscription. On `EVIDENCE_ADDED` message: append to local list and push text to `aria-live="polite"` region: `"New evidence added: [title]"`. Do not move focus.

---

### `VerificationAggregationPanel`

```tsx
interface VerificationAggregationPanelProps {
  claimId: string;
  phase: TimelinePhase;
  contractOutcome: 'TRUE' | 'FALSE' | null; // from contract read; null until FINALIZED
  outcomeLabel: string | null;              // from API projection
}
```

**"Verified" label gate:** Three conditions must all be true simultaneously:
1. `phase === 'FINALIZED'`
2. `contractOutcome !== null` (contract read confirms)
3. `outcomeLabel === contractOutcome`

Only when all three hold does the `"Verified"` label appear. Otherwise: `"Pending"`, `"Disputed"`, etc.

Stake amounts use `TokenAmount` primitive with tabular numerals.

Dispute event rendering: when `DISPUTE_CREATED` or `DISPUTE_CONFIRMED` event is in timeline, render disputer address (truncated) + reason in a `<dl>` with accessible labels.

Stale: render `"stale"` `SourceBadge` + manual refresh `<button>`.

---

### `ActionRail`

```tsx
interface ActionRailProps {
  claimId: string;
  chainId: number;
  phase: TimelinePhase;
}
```

Derives available actions from `SettlementAction.isCallable` (from the claim's API projection or contract read). Displays exactly one primary action button at a time.

**Priority order (highest wins):**
1. `reorged` state → `role="alert"` reorg banner; no action button; no wallet-connect affordance
2. Boundary failed (`ProtocolContractBoundary` or `IntegrityBoundary`) → boundary failure UI only
3. `isCallable = false` → disabled button + `role="status"[data-testid="write-readiness-reason"]`
4. Wallet not connected (no reorg) → wallet-connect affordance + `role="status"` explanation
5. `useWriteReadiness.isReady = false` → disabled button + reason
6. Ready → enabled button with descriptive `aria-label`

**Transaction lifecycle states:**
`pending` → `confirmed` → `finalized`; no state skipping. Transaction hash shown via `SafeExternalLink` to Optimism block explorer. On rejection: `role="status"` (not `role="alert"`) recovery banner + re-enable button.

---

### `SettlementRegion`

```tsx
interface SettlementRegionProps {
  claimId: string;
  phase: TimelinePhase;
  onPhaseChange: (phase: TimelinePhase) => void;
}
```

Embeds `<ClaimLifecycleTimeline claimId={claimId} enableRealtime={true} onPhaseChange={onPhaseChange} />`.

When phase is `PENDING_SETTLEMENT`, `SETTLED`, `PENDING_APPEAL_SETTLEMENT`, or `APPEAL_SETTLED`: render `"provisional"` qualifier + `projected` `SourceBadge` in the settlement outcome summary above the timeline. `FINALIZED` is only displayed when `phase === 'FINALIZED'`.

Stale: `<ApiStaleBanner>` + reconcile button.

`onPhaseChange` propagates up to `ClaimDetailComposer` which updates `ClaimHeader` via state — no full page reload.

---

### `ProvenanceFooter`

```tsx
interface ProvenanceFooterProps {
  chainId: number;
}
```

**Data sources:**
- Contract address: `release/addresses/${chainId}.json` — same resolution as `EconomicRiskDisclosure`
- Chain name + ID: `src/config/chains.ts` — no hardcoded strings
- Protocol version: `release/manifest.json` → `protocolVersion`
- Last-indexed block + `dataUpdatedAt`: `/api/freshness` via existing `useApiFreshness` hook (or direct query)

Contract address rendered as `<SafeExternalLink href={explorerUrl}>`. Explorer URL constructed from `src/config/chains.ts` block explorer base URL.

**Mobile collapsible:** `<details>`/`<summary>` element. Collapsed state: `aria-expanded="false"` on summary; open state: `aria-expanded="true"`. The toggle change is announced by the browser natively via the `<details>` element's built-in accessibility.

---

## Shared Primitives and Patterns

### `SourceBadge` atomicity

The consumer decides the `source` value in one place; the component maps `source` → text + colour + icon in a single `switch`. No split between setting label and setting colour.

```tsx
const BADGE_CONFIG = {
  contract:          { text: 'contract',         tone: 'neutral',  Icon: ChainIcon },
  projected:         { text: 'projected',        tone: 'info',     Icon: BroadcastIcon },
  'stale projection':{ text: 'stale projection', tone: 'stale',    Icon: WarningIcon },
} as const;
```

### Phase config shared module

`src/lib/phase-config.ts` exports `getPhaseConfig(phase: TimelinePhase)` and `formatPhase(phase)`. Both `ClaimLifecycleTimeline` and `ClaimHeader` import from this module to stay in sync.

### `FallbackBoundary`

Existing `FeatureErrorBoundary` from `src/components/common/FeatureErrorBoundary` is used as-is. `ClaimDetailComposer` wraps its data-dependent tree in a `FeatureErrorBoundary` with a custom `fallback` that includes `role="alert"` and a retry button.

### `ApiStaleBanner`

If not already a standalone component, extracted from existing stale-warning patterns in `ClaimLifecycleTimeline`. It accepts `onReconcile: () => void` and renders a banner with `role="status"` and a reconcile button.

---

## Testing Strategy

### Component Tests (`__tests__/ClaimDetailComposer.test.tsx`)

States covered (per Requirement 13.1):

| State | Mock setup |
|---|---|
| `loading` | `useClaimLifecycleTimeline` returns `{ isLoading: true }` |
| `not-found` | API query returns 404 |
| `stale-projection` | `isStale: true`, revalidation failed |
| `missing-evidence` | `evidence: []` or all URIs blocked by sanitizer |
| `unavailable-action` | `isCallable: false` on all `SettlementAction`s |
| `unknown-chain` | `isSupportedChain` returns `false` |
| `provisional-settled` | `phase: 'SETTLED'` |
| `finalized` | `phase: 'FINALIZED'`, contract read confirms |
| `reorged` | `useReorgReconciliation` returns reorg detected |
| `error` | critical fetch throws; `FallbackBoundary` catches |

Each test:
1. Renders component with state-specific mocks
2. Asserts correct ARIA roles and text
3. Asserts no fabricated protocol fields
4. Uses `@testing-library/user-event` for interaction

### Accessibility Tests (jest-axe)

For each state above:
- `expect(await axe(container)).toHaveNoViolations()`
- Keyboard navigation: Tab through all focusable elements, assert no traps
- Focus management: for `failed`/`reorged`, assert `document.activeElement` is error heading
- `aria-live` regions: assert announcements on state transition
- `prefers-reduced-motion`: mock `window.matchMedia`, assert `motion-reduce:` classes applied

### Storybook Stories

One story per state (matching test matrix). Each story uses MSW handlers (or static fixtures isolated from production adapters) to simulate the state. Interaction tests use `@storybook/test` to verify:
- Focus lands on error heading in `failed`/`reorged` stories
- Reconcile button triggers re-fetch in `stale-projection` story
- Phase change propagates without reload in `provisional-settled` → `finalized` transition story

### Visual Regression

Responsive snapshots at 375px, 768px, 1280px × light/dark using the Storybook snapshot runner. Stories represent all layout breakpoints.

---

## Security Constraints

1. **No fabrication**: every protocol field rendered from a real data source or rendered as `"—"`. Components must not derive amounts from UI state (e.g., stake inputs) and display them as protocol outcomes.
2. **No raw external HTML**: `dangerouslySetInnerHTML` is prohibited in `EvidenceRegion` and all child components.
3. **`SafeExternalLink` mandatory**: every URI from `evidence[]`, every transaction hash explorer link, every contract address explorer link goes through `SafeExternalLink`.
4. **`evidence-sanitizer` first**: all evidence URIs pass through `safeUrl()` before being passed to `SafeExternalLink`.
5. **Colour never sole signal**: every status uses text label + icon; `SourceBadge` and `Phase_Badge` include both.
6. **`IntegrityBoundary` wraps entire composer**: unsupported chain blocks the full page mutation surface before any child renders.
7. **Storybook fixtures isolated**: mock providers and fixtures imported only in `*.stories.tsx` and `*.test.tsx`; `tsconfig.json` `paths` alias `@/test-utils` is excluded from the production build via `pnpm verify-production-boundaries`.

---

## CI Gates

The following commands must all pass without concealed skips:

```bash
pnpm lint
pnpm type-check
pnpm test
pnpm storybook:build
pnpm build
pnpm verify-production-boundaries
```
