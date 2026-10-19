/**
 * V2 accessible UI primitives (V2-FE-121).
 *
 * Small, token-bound building blocks shared by the economic-risk,
 * settlement and rewards features. Each primitive keeps meaning in text +
 * iconography so colour is never the sole signal.
 */

export { Card, type CardProps } from './Card';
export { StatusBadge, type StatusBadgeProps } from './StatusBadge';
export { TokenAmount, type TokenAmountProps } from './TokenAmount';
export { ConfidenceMeter, type ConfidenceMeterProps, type ConfidenceBand } from './ConfidenceMeter';
export { OutcomeBadge, type OutcomeBadgeProps, type OutcomeKind } from './OutcomeBadge';
export { StakeWeightDisplay, type StakeWeightDisplayProps, type WeightSide } from './StakeWeightDisplay';
export { EvidenceSourcesList, type EvidenceSourcesListProps, type EvidenceSource, type EvidenceType } from './EvidenceSourcesList';
export { RiskIndicator, type RiskIndicatorProps, type RiskLevel, type RiskFactor } from './RiskIndicator';
export { VisualizationWithTable, type VisualizationWithTableProps, type DataTableColumn } from './VisualizationWithTable';
