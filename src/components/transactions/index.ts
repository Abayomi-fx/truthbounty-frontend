/**
 * Transaction Components - Public API
 * 
 * Canonical transaction state rendering components.
 * All write journeys should use TransactionStatusBadge.
 */

export { TransactionStatusBadge, TransactionStatusBadgeCompact } from './TransactionStatusBadge';
export type { TransactionStatusBadgeProps } from './TransactionStatusBadge';

// Re-export legacy components for backward compatibility
export { StatusCard } from './status-card';
export type { StatusCardProps } from './status-card';
