# Requirements Document

## Introduction

UI-FE-010 establishes the canonical claim-detail composition for the `/claims/:claimId` route. A claim-detail page must reconcile contract-canonical state with API-projection state without conflating the four distinct phases a claim can occupy: provisional, confirmed, finalized, and projected. The page exposes source integrity, lifecycle phase, deadline summaries, funding totals, verification and dispute aggregation, settlement boundaries, and available wallet actions — while covering the full set of degraded conditions: missing evidence, stale projection, unknown claim ID, and unavailable protocol actions.

All data shown as protocol state must originate from a canonical source (contract read, ABI-encoded receipt, or freshness-labelled API projection). The UI must never promote provisional outcomes to established truth, and it must never render untrusted evidence links without the project-wide unified security semantics (`SafeExternalLink` + `evidence-sanitizer`).

## Glossary

- **ClaimDetailComposer**: The root composition component rendered at `/claims/:claimId` that assembles all regions of the detail view.
- **ClaimHeader**: The sub-region that shows claim statement, lifecycle phase badge, and finality/freshness indicator.
- **EconomicSummaryPanel**: The sub-region that shows bounty amount, total staked, deadline summary, and funding source, all sourced from canonical contract reads or freshness-labelled API projection.
- **EvidenceRegion**: The sub-region that renders the ordered evidence timeline, applying `SafeExternalLink` and `evidence-sanitizer` to every untrusted URI.
- **VerificationAggregationPanel**: The sub-region that renders the verification and dispute aggregation summary, sourcing counts and stake totals from the API projection with explicit freshness labelling.
- **ActionRail**: The sub-region that exposes the available wallet action (verify, dispute, settle, finalize, claim rewards) for the connected account, gated by `useWriteReadiness` and `ProtocolContractBoundary`.
- **SettlementRegion**: The sub-region that renders the settlement and dispute timeline using the existing `ClaimLifecycleTimeline` component.
- **ProvenanceFooter**: The sub-region that renders technical provenance: contract address, chain, release version, last-indexed block, and freshness timestamp.
- **Composer**: Synonym for `ClaimDetailComposer` in acceptance criteria.
- **API_Projection**: The backend indexer projection of claim state; a read-only, freshness-labelled, non-authoritative data source.
- **Contract_Read**: A direct read against the canonical deployed contract via viem/wagmi; authoritative for on-chain state.
- **Freshness_Label**: A visible timestamp and staleness indicator that accompanies every API-projection value.
- **Source_Badge**: An accessible inline label (`contract` or `projected`) that visually distinguishes canonical contract data from API projection data on the same surface.
- **Phase_Badge**: A `StatusBadge` rendering one of the canonical `TimelinePhase` values with accessible text and icon glyph (never colour alone).
- **Integrity_Boundary**: `src/components/security/IntegrityBoundary.tsx`; wraps every protocol-mutation surface and fails closed on unsupported chain, missing config, or unresolved canonical artifacts.
- **SafeExternalLink**: `src/components/security/SafeExternalLink.tsx`; the mandatory wrapper for all outbound evidence or explorer links.
- **ProtocolContractBoundary**: `src/components/protocol/ProtocolContractBoundary.tsx`; wraps action surfaces.
- **Unknown_Claim**: A `claimId` that the API projection returns a 404 for or that the contract cannot resolve.
- **Stale_Projection**: An API projection that has exceeded its freshness threshold (`staleTime` from `queryClient.ts`) without a successful re-fetch.
- **Missing_Evidence**: A claim for which the evidence array is empty or all evidence items have unresolvable URIs.
- **Unavailable_Action**: A protocol action whose `isCallable` field is `false` in the `SettlementAction` or whose `useWriteReadiness` gate has not cleared.

## Requirements

### Requirement 1: Route and Composer Scaffold

**User Story:** As a user, I want to navigate to `/claims/:claimId` and see a well-structured claim detail page, so that I can review every aspect of a claim in a single canonical view.

#### Acceptance Criteria

1. THE `ClaimDetailComposer` SHALL render at the route `/claims/[claimId]` within the Next.js App Router `(dashboard)` route group.
2. WHEN the `claimId` parameter is present in the URL, THE `ClaimDetailComposer` SHALL pass the raw parameter to all data-fetching hooks without modification.
3. THE `ClaimDetailComposer` SHALL render, in document order: `ClaimHeader`, `EconomicSummaryPanel`, `EvidenceRegion`, `VerificationAggregationPanel`, `ActionRail`, `SettlementRegion`, and `ProvenanceFooter`.
4. THE `ClaimDetailComposer` SHALL wrap all protocol-mutation surfaces in `ProtocolContractBoundary` and `IntegrityBoundary`.
5. WHEN the page is in a `loading` state, THE `ClaimDetailComposer` SHALL render `ClaimDetailsSkeleton` with `role="status"` and `aria-busy="true"`.
6. IF the `claimId` cannot be resolved by the API projection (404) or the contract read returns no record, THEN THE `ClaimDetailComposer` SHALL render an explicit not-found state with a `role="alert"` heading and a navigation affordance back to `/claims`.
7. IF a critical data-fetch fails and cannot be recovered, THEN THE `ClaimDetailComposer` SHALL render a `FallbackBoundary` error state with `role="alert"`, an actionable retry control, and without fabricating any protocol field.

---

### Requirement 2: Source Integrity — Canonical vs Projected Fields

**User Story:** As a user, I want every displayed data field to be visibly sourced, so that I can distinguish contract-authoritative values from API projections and reason about their trustworthiness.

#### Acceptance Criteria

1. THE `ClaimDetailComposer` SHALL render a `Source_Badge` adjacent to every field that originates from `API_Projection`, labelling it as `"projected"`.
2. THE `ClaimDetailComposer` SHALL render a `Source_Badge` adjacent to every field that originates from `Contract_Read`, labelling it as `"contract"`.
3. THE `Source_Badge` SHALL carry an accessible name that includes both the source type and the as-of timestamp or block number.
4. WHEN a field's `API_Projection` freshness has exceeded the stale threshold, THE `ClaimDetailComposer` SHALL atomically replace the `Source_Badge` label with `"stale projection"` and apply the design-system `stale` semantic colour token simultaneously, with no intermediate state in which the label text and colour token are out of sync.
5. THE `Source_Badge` SHALL never use colour as the sole distinguishing signal; it SHALL also include a distinct text label and an icon glyph.
6. THE `ClaimDetailComposer` SHALL never display a `projected` field as if it were a `contract` field.

---

### Requirement 3: Lifecycle Phase and Finality

**User Story:** As a user, I want to see the current lifecycle phase of a claim with a clear finality indicator, so that I understand whether an outcome is provisional, confirmed, or finalized.

#### Acceptance Criteria

1. THE `ClaimHeader` SHALL render a `Phase_Badge` whose text exactly matches one of the `TimelinePhase` enum values (`CREATED`, `INDEXING`, `VERIFICATION_OPEN`, `VERIFICATION_CLOSED`, `DISPUTED`, `APPEAL_OPEN`, `PENDING_SETTLEMENT`, `SETTLED`, `PENDING_APPEAL_SETTLEMENT`, `APPEAL_SETTLED`, `PENDING_FINALIZATION`, `FINALIZED`, `STALE`, `ERROR`).
2. WHEN the current phase is `SETTLED` or `APPEAL_SETTLED`, THE `ClaimHeader` SHALL include a visible qualifier `"provisional"` adjacent to the phase label, so that the outcome is never described as established truth.
3. WHEN the current phase is `FINALIZED`, THE `ClaimHeader` SHALL render the `finalized` design-system semantic colour token and an accessible confirmation label.
4. WHEN the current phase is `STALE`, THE `ClaimHeader` SHALL render the `stale` design-system colour token, a `role="status"` region announcing the staleness, and a manual reconcile control.
5. WHEN the current phase is `ERROR`, THE `ClaimHeader` SHALL render a `role="alert"` region with an actionable recovery path.
6. THE `Phase_Badge` SHALL never rely on colour alone to convey phase meaning; it SHALL include a text label and a distinct icon glyph.
7. THE `ClaimHeader` SHALL render a `Freshness_Label` showing the last-updated timestamp derived from the API projection's `dataUpdatedAt` field.

---

### Requirement 4: Economic Summary — Bounty, Stake, and Deadlines

**User Story:** As a user, I want to see the bounty amount, total staked, and all relevant deadlines in one panel, so that I can assess the economic state of a claim without scrolling.

#### Acceptance Criteria

1. THE `EconomicSummaryPanel` SHALL render the bounty amount using the `TokenAmount` primitive with tabular numerals, the token symbol, and the canonical token address sourced from the release artifact.
2. THE `EconomicSummaryPanel` SHALL render the total staked amount using the `TokenAmount` primitive with the same token symbol.
3. WHEN a verification deadline is available from `API_Projection`, THE `EconomicSummaryPanel` SHALL render it with a `Freshness_Label` and the `projected` `Source_Badge`.
4. WHEN any deadline has passed, THE `EconomicSummaryPanel` SHALL render a `"closed"` label in place of the countdown and SHALL NOT show a negative countdown.
5. THE `EconomicSummaryPanel` SHALL never fabricate a token amount, gas estimate, or deadline value; WHEN a value is unavailable, it SHALL render an explicit `"—"` placeholder with a `title` attribute explaining the absence.
6. WHEN the `EconomicSummaryPanel` data is in a `loading` state, THE `EconomicSummaryPanel` SHALL render skeleton placeholders with `aria-busy="true"`.
7. THE `EconomicSummaryPanel` SHALL expose the protocol fee and bond parameters sourced from the `EconomicRiskDisclosure` component where those parameters have been verified by `ProtocolContractBoundary`.

---

### Requirement 5: Evidence Region and Security Semantics

**User Story:** As a user, I want to review the evidence linked to a claim, so that I can evaluate its supporting material — without being exposed to unsafe external content.

#### Acceptance Criteria

1. THE `EvidenceRegion` SHALL render an ordered list of evidence items sourced from the claim's `evidence` array (API projection), with the most recently added evidence first.
2. WHEN an evidence item has a URI value, THE `EvidenceRegion` SHALL wrap it in `SafeExternalLink` and SHALL pass the URI through `evidence-sanitizer` before rendering.
3. THE `EvidenceRegion` SHALL render each external evidence link with a visible `"(opens in new tab)"` annotation and `aria-label` that includes this annotation.
4. WHEN the evidence array contains a mix of resolvable and unresolvable URIs, THE `EvidenceRegion` SHALL render only the resolvable items, silently omitting unresolvable ones, and SHALL NOT display the empty-state message unless all items are unresolvable.
5. THE `EvidenceRegion` SHALL never render raw `dangerouslySetInnerHTML` for any evidence content.
6. WHEN an evidence item's `type` is `image` or `video`, THE `EvidenceRegion` SHALL render it through the sanitizer pipeline and SHALL include descriptive `alt` text or an accessible title.
7. THE `EvidenceRegion` SHALL display a `Freshness_Label` for the evidence list, reflecting the API projection's last-indexed timestamp.
8. WHEN a new evidence item is added via WebSocket update, THE `EvidenceRegion` SHALL announce the addition via a `aria-live="polite"` region without stealing focus.

---

### Requirement 6: Verification and Dispute Aggregation

**User Story:** As a user, I want to see the aggregated verification and dispute summary for a claim, so that I can assess community sentiment and understand dispute history.

#### Acceptance Criteria

1. THE `VerificationAggregationPanel` SHALL render the total number of verifications, the true-stake total, the false-stake total, and the current aggregated outcome label, all sourced from `API_Projection` with a `Freshness_Label`.
2. WHEN the `API_Projection` aggregation data is stale, THE `VerificationAggregationPanel` SHALL render a `"stale"` `Source_Badge` and a manual refresh control.
3. THE `VerificationAggregationPanel` SHALL render dispute status — if a dispute is open or has been resolved — with a `Source_Badge` labelled `"projected"` and a link to the full `SettlementRegion`.
4. THE `VerificationAggregationPanel` SHALL never describe a `DISPUTED` outcome as `VERIFIED`; the `"verified"` label SHALL only appear when the `TimelinePhase` is `FINALIZED`, the contract read confirms the final outcome, AND the `outcome_label_current` field equals the verified outcome value — all three conditions must be satisfied simultaneously.
5. WHEN a `DISPUTE_CREATED` or `DISPUTE_CONFIRMED` event is present in the timeline, THE `VerificationAggregationPanel` SHALL render the dispute reason and disputer address with an accessible description.
6. THE `VerificationAggregationPanel` SHALL render stake amounts using the `TokenAmount` primitive with tabular numerals.

---

### Requirement 7: Action Rail — Wallet Actions and Readiness Gate

**User Story:** As a connected wallet holder, I want to see and invoke the available protocol action for a claim, so that I can participate in verification, disputes, settlement, or reward claiming — without being able to submit an action that the protocol does not currently support.

#### Acceptance Criteria

1. THE `ActionRail` SHALL derive the set of available actions from `SettlementAction.isCallable` fields and the `useWriteReadiness` gate, and SHALL display exactly one primary action button at a time.
2. WHEN an action is available and `useWriteReadiness` clears, THE `ActionRail` SHALL enable the primary action button with a descriptive `aria-label`.
3. WHEN an action is `Unavailable_Action` (`isCallable = false`), THE `ActionRail` SHALL render the button in a disabled state with an accessible explanation in a `role="status"` region identified by `data-testid="write-readiness-reason"`.
4. WHEN no wallet is connected AND no reorg is active, THE `ActionRail` SHALL render a wallet-connect affordance rather than a disabled action button, with a `role="status"` region explaining the requirement.
4a. WHEN a reorg is detected on a previously confirmed action transaction AND the wallet is disconnected (or was never connected), THE `ActionRail` SHALL render the `role="alert"` reorg banner as the primary state, blocking re-enable until reconciliation is complete, and SHALL NOT replace that banner with the wallet-connect affordance.
5. THE `ActionRail` SHALL wrap every mutation surface in `ProtocolContractBoundary` and `IntegrityBoundary`; IF either boundary fails closed, THE `ActionRail` SHALL render the boundary's failure UI and SHALL NOT render a submit button.
6. WHEN a transaction is submitted, THE `ActionRail` SHALL transition through `pending` → `confirmed` → `finalized` states without skipping, showing the transaction hash with a `SafeExternalLink` to the block explorer.
7. WHEN a transaction is rejected by the user in the wallet, THE `ActionRail` SHALL render a `role="status"` (not `role="alert"`) recovery banner and re-enable the action button.
8. WHEN a reorg is detected on a previously confirmed action transaction, THE `ActionRail` SHALL downgrade to `reorged` state, render a `role="alert"` banner, and require reconciliation before re-enabling the action.
9. THE `ActionRail` SHALL never fabricate a transaction hash, gas estimate, or protocol outcome.

---

### Requirement 8: Settlement and Lifecycle Timeline Region

**User Story:** As a user, I want to see the full settlement and dispute timeline for a claim, so that I can follow the chain of events from creation through finalization.

#### Acceptance Criteria

1. THE `SettlementRegion` SHALL embed the existing `ClaimLifecycleTimeline` component, passing the `claimId` prop and `enableRealtime={true}`.
2. WHEN the timeline phase is `PENDING_SETTLEMENT`, `SETTLED`, `PENDING_APPEAL_SETTLEMENT`, or `APPEAL_SETTLED`, THE `SettlementRegion` SHALL render the settlement outcome with the `"provisional"` qualifier and the `projected` `Source_Badge`.
3. WHEN the timeline data is stale (`isStale = true`), THE `SettlementRegion` SHALL render the `ApiStaleBanner` with a manual reconcile control.
4. THE `SettlementRegion` SHALL never describe a `SETTLED` state as `FINALIZED`; the `finalized` state SHALL only be displayed when `TimelinePhase` is `FINALIZED`.
5. WHEN the `ClaimLifecycleTimeline` fires an `onPhaseChange` callback, THE `SettlementRegion` SHALL propagate the new phase to the `ClaimHeader` without a full page reload.

---

### Requirement 9: Provenance Footer

**User Story:** As a technically curious user, I want to inspect the contract address, chain, release version, and indexer freshness for a claim, so that I can independently verify the data sources.

#### Acceptance Criteria

1. THE `ProvenanceFooter` SHALL render the canonical contract address sourced from `release/addresses/<chainId>.json`, formatted as a `SafeExternalLink` to the block explorer.
2. THE `ProvenanceFooter` SHALL render the chain name and chain ID from `src/config/chains.ts`, not from a hardcoded string.
3. THE `ProvenanceFooter` SHALL render the protocol release version from `release/manifest.json` `protocolVersion` field.
4. THE `ProvenanceFooter` SHALL render the last-indexed block number and the `dataUpdatedAt` timestamp from the API projection freshness response (`/api/freshness`).
5. THE `ProvenanceFooter` SHALL be collapsible on mobile viewports to satisfy the responsive layout requirement, with the collapsed state announced to screen readers.

---

### Requirement 10: Degraded State Coverage

**User Story:** As a user, I want to see a clear and recoverable error when claim data is unavailable, the projection is stale, or protocol actions cannot be performed, so that I am never shown fabricated or misleading state.

#### Acceptance Criteria

1. WHEN the API projection returns a 404 for the requested `claimId` (`Unknown_Claim`), THE `ClaimDetailComposer` SHALL render an explicit not-found state with `role="alert"`, the text `"Claim not found"`, and a back-navigation link to `/claims`.
2. WHEN the API projection has not refreshed within its freshness threshold and a revalidation attempt has failed (`Stale_Projection`), THE `ClaimDetailComposer` SHALL render the `ApiStaleBanner` across all data-dependent regions and SHALL gate all write actions.
3. WHEN all evidence items have unresolvable URIs (`Missing_Evidence`), THE `EvidenceRegion` SHALL render the empty-state described in Requirement 5.4 without fabricating placeholder evidence.
4. WHEN a protocol action is not callable (`Unavailable_Action`), THE `ActionRail` SHALL render the disabled state described in Requirement 7.3 without hiding the control entirely.
5. WHEN the connected chain is not Optimism mainnet or Optimism Sepolia, THE `IntegrityBoundary` SHALL render a `role="alert"` unsupported-network notice and block all mutation surfaces.
6. WHEN `ClaimDetailComposer` data fetching times out, THE `ClaimDetailComposer` SHALL transition to a `failed` state with `role="alert"`, an actionable retry control, and SHALL NOT remain in `loading` state indefinitely.

---

### Requirement 11: Accessibility — Keyboard, Focus, ARIA, and Visual

**User Story:** As a user with a disability, I want the claim-detail page to be fully accessible, so that I can navigate, understand, and interact with all content using a keyboard, screen reader, or assistive technology.

#### Acceptance Criteria

1. THE `ClaimDetailComposer` SHALL be fully navigable by keyboard using Tab, Shift-Tab, Enter, and Space, with no keyboard traps outside intentional modal dialogs.
2. WHEN a state transition occurs (e.g., transaction submitted, phase changed, stale data detected), THE `ClaimDetailComposer` SHALL announce the change via an `aria-live="polite"` region without moving focus.
3. WHEN a `failed` or `reorged` state is entered, THE `ClaimDetailComposer` SHALL move focus to the error heading.
4. THE `ClaimDetailComposer` SHALL use design-system semantic colour tokens exclusively for all text and interactive elements in both light and dark themes; using the semantic tokens correctly is the sole compliance proxy for WCAG 2.2 AA contrast on this surface.
5. WHEN `prefers-reduced-motion: reduce` is set, THE `ClaimDetailComposer` SHALL suppress all non-essential animations and transitions.
6. THE `ClaimDetailComposer` SHALL be rendered without two-dimensional scrolling at 200% browser zoom on approved desktop, tablet, and mobile widths, except for genuine data tables.
7. ALL interactive controls in `ClaimDetailComposer` SHALL have a minimum touch target of 44×44 CSS pixels.
8. EVERY icon in `ClaimDetailComposer` that carries meaning SHALL have an `aria-label` or companion visible text; decorative icons SHALL have `aria-hidden="true"`.

---

### Requirement 12: Responsive Layout

**User Story:** As a user on any device, I want the claim-detail page to adapt its layout to my screen size, so that I can read and interact with all content without horizontal scrolling or layout breakage.

#### Acceptance Criteria

1. ON mobile viewports (< 768px), THE `ClaimDetailComposer` SHALL render a single-column stacked layout with the primary action at the top of the viewport-visible region.
2. ON tablet viewports (768px–1279px), THE `ClaimDetailComposer` SHALL render a two-column layout for claim/action regions where space permits, collapsing to single column when content would overflow.
3. ON desktop viewports (≥ 1280px), THE `ClaimDetailComposer` SHALL render the content column alongside the contextual action rail and lifecycle timeline as a third column.
4. THE `ClaimDetailComposer` SHALL pass visual regression snapshot tests at approved breakpoints (375px, 768px, 1280px) in both light and dark themes.

---

### Requirement 13: Testing — Unit, Component, Storybook, and Accessibility

**User Story:** As an engineer, I want comprehensive test coverage for the claim-detail composition, so that correctness, accessibility, and visual states are continuously verified in CI.

#### Acceptance Criteria

1. THE `ClaimDetailComposer` SHALL have unit/component tests covering: `loading`, `not-found`, `stale-projection`, `missing-evidence`, `unavailable-action`, `unknown-chain`, `provisional-settled`, `finalized`, `reorged`, and `error` states.
2. THE `ClaimDetailComposer` SHALL have Storybook stories for each of the states in criterion 13.1, with interaction tests verifying focus management and state transitions.
3. THE `ClaimDetailComposer` SHALL have accessibility tests using `jest-axe` covering keyboard navigation, focus management, ARIA labels, live-region announcements, contrast, and `prefers-reduced-motion` for all states in criterion 13.1.
4. THE `ClaimDetailComposer` SHALL have responsive visual regression snapshot tests at 375px, 768px, and 1280px in both light and dark themes.
5. THE `ClaimDetailComposer` test suite SHALL pass `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm storybook:build`, and `pnpm build` without concealed skips.
6. THE `ClaimDetailComposer` SHALL import no test fixtures, mock providers, or Storybook story modules from production source files, as enforced by `pnpm verify-production-boundaries`.
