/**
 * Canonical Transaction Status Badge
 * 
 * Single source of truth for rendering transaction state across all write journeys.
 * Maps transaction-machine states to approved Gate C copy and ARIA semantics.
 * 
 * States: idle, preparing, signature-requested, submitted, confirming, safe,
 *         indexing, finalized, dropped, replaced, reverted
 */

import type { TransactionStatus } from '@/lib/transaction-machine';

export interface TransactionStatusBadgeProps {
  status: TransactionStatus;
  txHash?: `0x${string}` | null;
  replacedBy?: `0x${string}` | null;
  confirmations?: number | null;
  className?: string;
}

interface StatusConfig {
  label: string;
  description: string;
  variant: 'idle' | 'pending' | 'success' | 'warning' | 'error';
  ariaLive: 'off' | 'polite' | 'assertive';
  icon: string;
}

const STATUS_CONFIG: Record<TransactionStatus, StatusConfig> = {
  idle: {
    label: 'Ready',
    description: 'No action started',
    variant: 'idle',
    ariaLive: 'off',
    icon: '○',
  },
  preparing: {
    label: 'Preparing',
    description: 'Validating prerequisites',
    variant: 'pending',
    ariaLive: 'polite',
    icon: '⚙',
  },
  'signature-requested': {
    label: 'Awaiting signature',
    description: 'Wallet request open',
    variant: 'pending',
    ariaLive: 'polite',
    icon: '✍',
  },
  submitted: {
    label: 'Submitted',
    description: 'Transaction broadcast to network',
    variant: 'pending',
    ariaLive: 'polite',
    icon: '⏱',
  },
  confirming: {
    label: 'Confirming',
    description: 'Waiting for confirmations',
    variant: 'pending',
    ariaLive: 'polite',
    icon: '⚙',
  },
  safe: {
    label: 'Safe',
    description: 'Transaction safe, awaiting finality',
    variant: 'warning',
    ariaLive: 'polite',
    icon: '◐',
  },
  indexing: {
    label: 'Indexing',
    description: 'Indexer processing transaction',
    variant: 'warning',
    ariaLive: 'polite',
    icon: '⚙',
  },
  finalized: {
    label: 'Complete',
    description: 'Transaction finalized and indexed',
    variant: 'success',
    ariaLive: 'assertive',
    icon: '✓',
  },
  dropped: {
    label: 'Dropped',
    description: 'Transaction dropped from mempool',
    variant: 'error',
    ariaLive: 'assertive',
    icon: '✕',
  },
  replaced: {
    label: 'Replaced',
    description: 'Transaction replaced by another',
    variant: 'error',
    ariaLive: 'assertive',
    icon: '⇄',
  },
  reverted: {
    label: 'Reverted',
    description: 'Transaction execution failed on-chain',
    variant: 'error',
    ariaLive: 'assertive',
    icon: '✕',
  },
};

const VARIANT_STYLES = {
  idle: 'bg-slate-800 text-slate-400 border-slate-700',
  pending: 'bg-blue-950 text-blue-300 border-blue-800',
  success: 'bg-green-950 text-green-300 border-green-800',
  warning: 'bg-amber-950 text-amber-300 border-amber-800',
  error: 'bg-red-950 text-red-300 border-red-800',
};

export function TransactionStatusBadge({
  status,
  txHash,
  replacedBy,
  confirmations,
  className = '',
}: TransactionStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const variantStyles = VARIANT_STYLES[config.variant];

  const showConfirmations = status === 'confirming' && confirmations != null;
  const showHash = txHash && (status === 'submitted' || status === 'confirming' || status === 'safe');
  const showReplacement = status === 'replaced' && replacedBy;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${variantStyles} ${className}`}
      role="status"
      aria-live={config.ariaLive}
      aria-atomic="true"
    >
      <span aria-hidden="true" className="text-base leading-none">
        {config.icon}
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{config.label}</span>
        <span className="text-xs opacity-90">{config.description}</span>
        {showConfirmations && (
          <span className="text-xs opacity-75">
            {confirmations} confirmation{confirmations !== 1 ? 's' : ''}
          </span>
        )}
        {showHash && (
          <span className="text-xs font-mono opacity-75">
            {txHash.slice(0, 10)}...{txHash.slice(-8)}
          </span>
        )}
        {showReplacement && (
          <span className="text-xs font-mono opacity-75">
            Replaced by {replacedBy.slice(0, 10)}...
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Compact variant for inline use (e.g. in lists, sidebars)
 */
export function TransactionStatusBadgeCompact({
  status,
  className = '',
}: Pick<TransactionStatusBadgeProps, 'status' | 'className'>) {
  const config = STATUS_CONFIG[status];
  const variantStyles = VARIANT_STYLES[config.variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${variantStyles} ${className}`}
      role="status"
      aria-live={config.ariaLive}
      aria-label={`${config.label}: ${config.description}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
