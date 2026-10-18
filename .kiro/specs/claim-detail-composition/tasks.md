# Implementation Plan: Claim Detail Composition (UI-FE-010)

## Overview

Implements the canonical `/claims/[claimId]` detail page by composing seven visual sub-regions inside `ClaimDetailComposer`. Tasks are ordered so shared primitives and the route scaffold are in place before any sub-region component is built, and all testing/CI tasks follow the implementation.

## Tasks

- [ ] 1. Shared Primitives — SourceBadge, FreshnessLabel, and Phase Config
  - Create `src/lib/phase-config.ts` exporting `getPhaseConfig(phase: TimelinePhase)` and `formatPhase(phase)`, extracted from `ClaimLifecycleTimeline` so both components share one source of truth
  - Create `src/components/features/claim-detail/SourceBadge.tsx` with `SourceBadgeProps` interface (`source`, `asOf`, `className`), `BADGE_CONFIG` map mapping each source to text + colour token + icon glyph, and `aria-label` combining source type and timestamp
  - Ensure `SourceBadge` renders chain-link / broadcast / warning-triangle glyphs with `aria-hidden="true"` and never uses colour as the sole distinguishing signal
  - Create `src/components/features/claim-detail/FreshnessLabel.tsx` with `FreshnessLabelProps` (`dataUpdatedAt`, `isStale`), `role="status"`, and `text-semantic-stale` token applied when stale
  - Create `src/components/features/claim-detail/index.ts` barrel file exporting all public symbols from the feature directory
  - Run `pnpm type-check` and `pnpm lint` to confirm no type errors in new primitives

- [ ] 2. Route Scaffold and ClaimDetailComposer Shell
  - Create `src/app/(dashboard)/claims/[claimId]/page.tsx` as a thin server-component shell that reads `params.claimId` and passes it to `ClaimDetailComposer`
  - Create `src/components/features/claim-detail/ClaimDetailComposer.tsx` with `ClaimDetailComposerProps` (`claimId: string`) and the master state-machine branches: `loading`, `not-found`, `failed`, `stale`, `content`
  - Wire `loading` branch to `<ClaimDetailsSkeleton role="status" aria-busy="true" />`
  - Wire `not-found` branch to a `role="alert"` heading `"Claim not found"` and a `<Link href="/claims">` back-navigation affordance
  - Wire `failed` branch to `<FeatureErrorBoundary>` fallback with `role="alert"`, actionable retry `<button>`, and no fabricated protocol fields
  - Wire `stale` branch to `<ApiStaleBanner>` with `onReconcile` callback; gate all write actions
  - Wrap the full composer in `<IntegrityBoundary>` for chain-gate enforcement before any child renders
  - Add `aria-live="polite"` announcement region and `errorHeadingRef` with `focus()` call on transition to `failed` or `reorged`
  - Implement Tailwind responsive layout: single-column on mobile < 768px, `grid-cols-2` on tablet 768–1279px, `grid-cols-[minmax(0,1fr)_360px_300px]` on desktop ≥ 1280px

- [ ] 3. ClaimHeader
  - Create `src/components/features/claim-detail/ClaimHeader.tsx` with `ClaimHeaderProps` (`claimId`, `statement`, `phase`, `dataUpdatedAt`, `isStale`, `onReconcile`)
  - Implement `Phase_Badge` using `getPhaseConfig`/`formatPhase` from `src/lib/phase-config.ts` with text label and icon glyph; no colour-only signal
  - Add `"(provisional)"` `<span>` adjacent to badge when phase is `SETTLED` or `APPEAL_SETTLED`; include qualifier in `aria-label`
  - Apply `text-semantic-finalized` token and accessible confirmation `<span>` when phase is `FINALIZED`
  - Render `role="status"` region and reconcile `<button>` when phase is `STALE`; apply `text-semantic-stale` token
  - Render `role="alert"` region with recovery `<button>` when phase is `ERROR`
  - Embed `<FreshnessLabel dataUpdatedAt={dataUpdatedAt} isStale={isStale} />` below the phase badge

- [ ] 4. EconomicSummaryPanel
  - Create `src/components/features/claim-detail/EconomicSummaryPanel.tsx` with `EconomicSummaryPanelProps` (`claimId`, `chainId`) and a `useQuery` for the claim API projection
  - Render bounty and total-staked using `<TokenAmount>` primitive with `fontVariantNumeric: "tabular-nums"` and token symbol sourced from the release artifact
  - Render verification deadline with `<FreshnessLabel>` and `projected` `<SourceBadge>` when available from API projection; render `"Closed"` label with no countdown when deadline has passed
  - Render `"—"` wrapped in `<span title="<reason>">` for every unavailable value; never fabricate `0` or a placeholder amount
  - Wrap data rows in skeleton placeholders with `aria-busy="true"` on the container during loading state
  - Expose protocol fee and bond parameters from `EconomicRiskDisclosure` where verified by `ProtocolContractBoundary`

- [ ] 5. EvidenceRegion
  - Create `src/components/features/claim-detail/EvidenceRegion.tsx` with `EvidenceRegionProps` (`claimId`, `dataUpdatedAt`, `isStale`) and API projection query for the evidence array
  - For each evidence item, run `safeUrl(item.uri)` from `evidence-sanitizer`; keep only items where result is `{ ok: true }`; silently discard blocked items
  - Render the filtered list via `<SafeExternalLink>` with visible `<span className="sr-only">(opens in new tab)</span>` and descriptive `aria-label` on every link
  - Render empty-state `"No verifiable evidence is available for this claim."` only when the entire filtered list is empty
  - Handle `image`/`video` evidence items with `alt` text from `item.description`, falling back to `"Evidence item [n]"`; prohibit `dangerouslySetInnerHTML`
  - Subscribe to `useWebSocket` for `EVIDENCE_ADDED` events; append to local list and announce via `aria-live="polite"` region without moving focus
  - Render `<FreshnessLabel>` reflecting the API projection's last-indexed timestamp

- [ ] 6. VerificationAggregationPanel
  - Create `src/components/features/claim-detail/VerificationAggregationPanel.tsx` with `VerificationAggregationPanelProps` (`claimId`, `phase`, `contractOutcome`, `outcomeLabel`)
  - Render total verifications, true-stake total, and false-stake total using `<TokenAmount>` with tabular numerals; label all values with `projected` `<SourceBadge>` and `<FreshnessLabel>`
  - Implement the three-condition `"Verified"` gate: `phase === 'FINALIZED'` AND `contractOutcome !== null` AND `outcomeLabel === contractOutcome`; use `"Pending"` / `"Disputed"` otherwise
  - Render dispute status with `projected` `<SourceBadge>` and link to `SettlementRegion` when a dispute is open or resolved
  - When `DISPUTE_CREATED` or `DISPUTE_CONFIRMED` events are present in the timeline, render disputer address (truncated) and reason in a `<dl>` with accessible labels
  - Render `"stale"` `<SourceBadge>` and manual refresh `<button>` when aggregation data is stale

- [ ] 7. ActionRail
  - Create `src/components/features/claim-detail/ActionRail.tsx` with `ActionRailProps` (`claimId`, `chainId`, `phase`) and derive available actions from `SettlementAction.isCallable`
  - Implement priority-ordered rendering: reorged banner → boundary failure UI → disabled button (isCallable false) → wallet-connect affordance → write-readiness disabled → enabled button; display exactly one primary action button at a time
  - Render `role="alert"` reorg banner via `useReorgReconciliation`; block re-enable until reconciliation completes; do not replace banner with wallet-connect affordance during active reorg
  - Wrap all mutation surfaces in `<ProtocolContractBoundary>` and `<IntegrityBoundary>`; render boundary failure UI (not a submit button) when either fails closed
  - Render disabled button with `role="status" data-testid="write-readiness-reason"` explanation when action is `Unavailable_Action`
  - Implement transaction lifecycle states `pending` → `confirmed` → `finalized` without skipping; show transaction hash via `<SafeExternalLink>` to Optimism block explorer
  - On wallet rejection, render `role="status"` (not `role="alert"`) recovery banner and re-enable the action button

- [ ] 8. SettlementRegion
  - Create `src/components/features/claim-detail/SettlementRegion.tsx` with `SettlementRegionProps` (`claimId`, `phase`, `onPhaseChange`)
  - Embed `<ClaimLifecycleTimeline claimId={claimId} enableRealtime={true} onPhaseChange={onPhaseChange} />`
  - Render `"provisional"` qualifier and `projected` `<SourceBadge>` in the settlement outcome summary when phase is `PENDING_SETTLEMENT`, `SETTLED`, `PENDING_APPEAL_SETTLEMENT`, or `APPEAL_SETTLED`
  - Render the `finalized` state display only when `phase === 'FINALIZED'`; never display `FINALIZED` for a `SETTLED` phase
  - Render `<ApiStaleBanner>` with manual reconcile `<button>` when `isStale` is true
  - Propagate `onPhaseChange` callback up to `ClaimDetailComposer` to update `ClaimHeader` phase state without a full page reload

- [ ] 9. ProvenanceFooter
  - Create `src/components/features/claim-detail/ProvenanceFooter.tsx` with `ProvenanceFooterProps` (`chainId`)
  - Read contract address from `release/addresses/${chainId}.json` and render as `<SafeExternalLink>` to block explorer; construct explorer URL from `src/config/chains.ts`
  - Render chain name and chain ID from `src/config/chains.ts`; no hardcoded strings
  - Read protocol version from `release/manifest.json` `protocolVersion` field and render it
  - Fetch last-indexed block number and `dataUpdatedAt` from `/api/freshness` via `useApiFreshness` hook and render both values
  - Wrap the footer in a `<details>`/`<summary>` element for mobile collapsibility; verify `aria-expanded` toggles correctly and state change is announced natively

- [ ] 10. Component and Unit Tests
  - Create `src/components/features/claim-detail/__tests__/ClaimDetailComposer.test.tsx` with mock setup and assertions for `loading`, `not-found`, `stale-projection`, and `error` states
  - Extend the Composer test file with `missing-evidence`, `unavailable-action`, `unknown-chain`, `provisional-settled`, `finalized`, and `reorged` states
  - Create per-component test files (`ClaimHeader.test.tsx`, `EconomicSummaryPanel.test.tsx`, `EvidenceRegion.test.tsx`, `VerificationAggregationPanel.test.tsx`, `ActionRail.test.tsx`, `SettlementRegion.test.tsx`, `ProvenanceFooter.test.tsx`) covering primary rendering logic
  - Add `jest-axe` accessibility assertions (`expect(await axe(container)).toHaveNoViolations()`) for all ten states in `ClaimDetailComposer.test.tsx`
  - Test focus management: assert `document.activeElement` is the error heading after `failed` and `reorged` transitions
  - Test `prefers-reduced-motion`: mock `window.matchMedia` and assert `motion-reduce:` Tailwind classes are applied
  - Assert `pnpm verify-production-boundaries` passes — no test fixtures, mock providers, or story modules imported from production source files

- [ ] 11. Storybook Stories and Accessibility Tests
  - Create `src/stories/claim-detail/ClaimDetailComposer.stories.tsx` with one story per state: `loading`, `not-found`, `stale-projection`, `missing-evidence`, `unavailable-action`, `unknown-chain`, `provisional-settled`, `finalized`, `reorged`, `error`
  - Configure MSW (or static fixture) handlers per story, isolating fixtures from production adapters
  - Add `@storybook/test` interaction test to `failed`/`reorged` stories verifying focus lands on the error heading
  - Add interaction test to `stale-projection` story verifying the reconcile button triggers a re-fetch
  - Add interaction test to `provisional-settled` story verifying phase-change propagation to `ClaimHeader` without a full page reload
  - Configure responsive snapshot stories at 375px, 768px, and 1280px viewports in both light and dark themes; verify `pnpm storybook:build` passes

- [ ] 12. CI Verification Pass
  - Run `pnpm lint` and fix all ESLint errors introduced by new files
  - Run `pnpm type-check` and resolve all TypeScript errors across the feature directory and updated route
  - Run `pnpm test` and confirm all component tests, accessibility tests, and snapshot tests pass without concealed skips
  - Run `pnpm storybook:build` and resolve any Storybook compilation or story errors
  - Run `pnpm verify-production-boundaries` and confirm no test/mock imports bleed into production bundles
  - Run `pnpm build` and confirm the Next.js production build succeeds with the new `/claims/[claimId]` route

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": [1] },
    { "wave": 2, "tasks": [2] },
    { "wave": 3, "tasks": [3, 4, 5, 6, 7, 8, 9] },
    { "wave": 4, "tasks": [10] },
    { "wave": 5, "tasks": [11] },
    { "wave": 6, "tasks": [12] }
  ]
}
```

Tasks 3–9 can be implemented in parallel once tasks 1 and 2 are complete. Tasks 10–12 are sequential and must follow the completion of all implementation tasks.

## Notes

- The existing `src/app/(dashboard)/claims/[id]/page.tsx` route is left untouched. The new route uses the parameter name `claimId` for consistency with hooks and types.
- `ApiStaleBanner` should be extracted as a standalone component from existing stale-warning patterns in `ClaimLifecycleTimeline` if it does not already exist.
- All mock providers and test fixtures must be imported only in `*.stories.tsx` and `*.test.tsx` files, never from production source files, as enforced by `pnpm verify-production-boundaries`.
- Security invariants: no `dangerouslySetInnerHTML` in `EvidenceRegion`, all external URIs through `SafeExternalLink` + `evidence-sanitizer`, all mutation surfaces wrapped in `ProtocolContractBoundary` + `IntegrityBoundary`, colour never the sole distinguishing signal.
