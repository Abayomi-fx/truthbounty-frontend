/**
 * claim-detail feature — public exports (UI-FE-010)
 *
 * All symbols intended for use outside the feature directory are re-exported
 * from this barrel.  Import from `@/components/features/claim-detail` rather
 * than from individual component files so internal paths remain an
 * implementation detail.
 */

// Shared primitives (Task 1)
export { SourceBadge } from './SourceBadge';
export type { SourceBadgeProps, BadgeSource } from './SourceBadge';
export { BADGE_CONFIG } from './SourceBadge';

export { FreshnessLabel } from './FreshnessLabel';
export type { FreshnessLabelProps } from './FreshnessLabel';

// Composer (Task 2)
export { ClaimDetailComposer } from './ClaimDetailComposer';
export type { ClaimDetailComposerProps } from './ClaimDetailComposer';

// Sub-regions (Tasks 3–9)
export { ClaimHeader } from './ClaimHeader';
export type { ClaimHeaderProps } from './ClaimHeader';

export { EconomicSummaryPanel } from './EconomicSummaryPanel';
export type { EconomicSummaryPanelProps } from './EconomicSummaryPanel';

export { EvidenceRegion } from './EvidenceRegion';
export type { EvidenceRegionProps } from './EvidenceRegion';

export { VerificationAggregationPanel } from './VerificationAggregationPanel';
export type { VerificationAggregationPanelProps } from './VerificationAggregationPanel';

export { ActionRail } from './ActionRail';
export type { ActionRailProps } from './ActionRail';

export { SettlementRegion } from './SettlementRegion';
export type { SettlementRegionProps } from './SettlementRegion';

export { ProvenanceFooter } from './ProvenanceFooter';
export type { ProvenanceFooterProps } from './ProvenanceFooter';

// Task 2 — composer, stale banner
export { ClaimDetailComposer } from './ClaimDetailComposer';
export type { ClaimDetailComposerProps } from './ClaimDetailComposer';

export { ApiStaleBanner } from './ApiStaleBanner';
export type { ApiStaleBannerProps } from './ApiStaleBanner';
