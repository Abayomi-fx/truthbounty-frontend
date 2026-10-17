'use client';

/**
 * UI-FE-077 — accessible RPC health/quorum/failover presentation.
 *
 * Renders only the sanitized presentation model: no provider URLs, API keys,
 * or raw observation payloads. The role/aria-live pair comes from the health
 * state (polite status for primary/fallback/degraded-with-quorum, assertive
 * alert for stale/unavailable/divergence).
 */

import type { RpcHealthPresentation } from '@/lib/rpc-health';

export interface RpcHealthBannerProps {
  presentation: RpcHealthPresentation;
  onRetry?: () => void;
  className?: string;
}

const TONE_CLASSES: Record<RpcHealthPresentation['tone'], string> = {
  success:
    'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100',
  warning:
    'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100',
  danger:
    'border-red-300 bg-red-50 text-red-950 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100',
  neutral:
    'border-border bg-muted/30 text-foreground',
};

export function RpcHealthBanner({
  presentation,
  onRetry,
  className = '',
}: RpcHealthBannerProps) {
  const canRetry =
    presentation.recoveryAction !== 'none' && presentation.recoveryLabel !== null;

  return (
    <section
      role={presentation.role}
      aria-live={presentation.ariaLive}
      aria-atomic="true"
      data-testid={`rpc-health-${presentation.state}`}
      data-rpc-health-state={presentation.state}
      data-rpc-quorum={presentation.quorumSummary}
      data-rpc-mutations={presentation.mutationSummary}
      className={`flex flex-col gap-2 rounded-lg border p-4 text-sm ${TONE_CLASSES[presentation.tone]} ${className}`}
    >
      <p className="font-semibold">{presentation.label}</p>
      <p>{presentation.message}</p>
      <dl className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        <div className="flex gap-1">
          <dt className="font-medium">Quorum:</dt>
          <dd>{presentation.quorumSummary}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium">Mutations:</dt>
          <dd>{presentation.mutationSummary}</dd>
        </div>
      </dl>
      {canRetry && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="self-start rounded-md border border-current px-3 py-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {presentation.recoveryLabel}
        </button>
      )}
    </section>
  );
}

export default RpcHealthBanner;
