'use client';

/**
 * ActionRail — wallet action surface with priority-ordered readiness gate (UI-FE-010 Task 7)
 *
 * Priority order (highest wins, Req 7):
 *   1. Reorged  → role="alert" reorg banner; no action or wallet-connect
 *   2. Boundary failed → boundary failure UI only
 *   3. isCallable=false → disabled button + role="status" reason
 *   4. No wallet (no reorg) → wallet-connect affordance
 *   5. useWriteReadiness not ready → disabled button + reason
 *   6. Ready → enabled primary action button
 *
 * Transaction lifecycle: pending → confirmed → finalized (no skipping).
 * Wallet rejection: role="status" (not role="alert") recovery banner.
 * Reorg: role="alert" banner; re-enable blocked until reconciliation.
 */

import * as React from 'react';
import { ProtocolContractBoundary } from '@/components/protocol/ProtocolContractBoundary';
import { IntegrityBoundary } from '@/components/security/IntegrityBoundary';
import { SafeExternalLink } from '@/components/security/SafeExternalLink';
import { useWriteReadiness } from '@/hooks/useWriteReadiness';
import { useReorgReconciliation } from '@/hooks/useReorgReconciliation';
import { getChainConfig } from '@/config/chains';
import { cn } from '@/lib/utils';
import type { TimelinePhase } from '@/app/types/lifecycle';
import type { SettlementAction } from '@/app/types/settlement';

export interface ActionRailProps {
  claimId: string;
  chainId: number;
  phase: TimelinePhase;
  /** Injected in tests / Storybook to bypass live contract reads. */
  settlementActionsOverride?: SettlementAction[];
}

/** Transaction display lifecycle — Req 7.6 */
type TxLifecycle = 'idle' | 'pending' | 'confirmed' | 'finalized' | 'rejected';

export function ActionRail({
  claimId,
  chainId,
  phase,
  settlementActionsOverride,
}: ActionRailProps) {
  const writeReadiness = useWriteReadiness({ expectedChainId: chainId });
  const { banner: reorgBanner, acknowledge: acknowledgeReorg } = useReorgReconciliation();
  const isReorged = reorgBanner.state !== 'hidden';

  const [txLifecycle, setTxLifecycle] = React.useState<TxLifecycle>('idle');
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [rejectionCount, setRejectionCount] = React.useState(0);

  // Derive explorer URL from chain config
  const explorerBase = React.useMemo(() => {
    try {
      return getChainConfig(chainId).blockExplorer.url;
    } catch {
      return 'https://optimistic.etherscan.io';
    }
  }, [chainId]);

  // Derive the primary callable action — exactly one at a time (Req 7.1)
  const primaryAction: SettlementAction | null = React.useMemo(() => {
    const actions = settlementActionsOverride ?? deriveDefaultActions(phase, claimId);
    return actions.find((a) => a.isCallable) ?? actions[0] ?? null;
  }, [settlementActionsOverride, phase, claimId]);

  const isCallable = primaryAction?.isCallable ?? false;
  const unavailableReason = primaryAction?.reason ?? 'This action is not currently available.';

  // Simulate submit (real implementation wires viem/wagmi write here)
  const handleSubmit = React.useCallback(async () => {
    if (!isCallable || !writeReadiness.isReady) return;
    setTxLifecycle('pending');
    // TODO(Task 7 impl): wire actual contract write here
  }, [isCallable, writeReadiness.isReady]);

  const handleResetAfterRejection = React.useCallback(() => {
    setTxLifecycle('idle');
    setTxHash(null);
    setRejectionCount((c) => c + 1);
  }, []);

  // ── Render priority branches ───────────────────────────────────────────

  return (
    <IntegrityBoundary>
      <ProtocolContractBoundary chainId={chainId}>
        <div
          className="rounded-xl border border-border bg-surface p-5 sm:p-6"
          data-testid="action-rail"
        >
          <h2 className="tb-section text-ink mb-4 font-semibold">Actions</h2>

          {/* Priority 1: Reorg active — role="alert", block everything (Req 7.8, 4a) */}
          {isReorged && (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-lg border border-destructive/40 bg-destructive/10 p-4"
              data-testid="reorg-banner"
            >
              <p className="text-sm font-semibold text-destructive">
                Chain reorganisation detected
              </p>
              <p className="mt-1 text-xs text-destructive/80">
                {reorgBanner.message ||
                  'A previously confirmed transaction may be invalid. Reconcile before continuing.'}
              </p>
              <button
                type="button"
                onClick={acknowledgeReorg}
                className={cn(
                  'mt-3 rounded border border-destructive/60 bg-destructive/20 px-3 py-1.5',
                  'text-xs font-medium text-destructive hover:bg-destructive/30',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive',
                  'min-h-[44px]',
                )}
                aria-label="Acknowledge reorg and begin reconciliation"
              >
                Acknowledge &amp; reconcile
              </button>
            </div>
          )}

          {/* Priority 3: Unavailable action (no reorg) — Req 7.3 */}
          {!isReorged && primaryAction && !isCallable && (
            <>
              <button
                type="button"
                disabled
                aria-label={`${primaryAction.type} — ${unavailableReason}`}
                aria-describedby="write-readiness-reason"
                className={cn(
                  'w-full rounded-lg border border-border bg-muted/40 px-4 py-3',
                  'text-sm font-semibold text-ink-muted cursor-not-allowed',
                  'min-h-[44px]',
                )}
                data-testid="action-button-unavailable"
              >
                {formatActionLabel(primaryAction.type)}
              </button>
              <div
                id="write-readiness-reason"
                role="status"
                aria-live="polite"
                className="mt-2 text-xs text-ink-muted"
                data-testid="write-readiness-reason"
              >
                {unavailableReason}
              </div>
            </>
          )}

          {/* Priority 4: No wallet connected (no reorg) — Req 7.4 */}
          {!isReorged && !writeReadiness.account && isCallable && (
            <>
              <div
                role="status"
                aria-live="polite"
                className="mb-3 text-xs text-ink-muted"
                data-testid="wallet-connect-reason"
              >
                Connect your wallet to perform this action.
              </div>
              {/* WalletConnect affordance — actual button wired by WalletConnection component */}
              <div
                className="flex items-center justify-center rounded-lg border border-dashed border-border p-4 text-sm text-ink-muted"
                data-testid="wallet-connect-affordance"
              >
                <span aria-hidden="true" className="mr-2">🔗</span>
                Wallet not connected
              </div>
            </>
          )}

          {/* Priority 5 & 6: Write-readiness gate + enabled action (no reorg, wallet connected) */}
          {!isReorged && writeReadiness.account && isCallable && (
            <>
              {/* Wallet rejection recovery — Req 7.7: role="status" NOT role="alert" */}
              {txLifecycle === 'rejected' && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mb-3 flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                  data-testid="rejection-banner"
                >
                  <span className="text-ink-muted">Transaction rejected in wallet.</span>
                  <button
                    type="button"
                    onClick={handleResetAfterRejection}
                    className="text-xs font-medium text-info underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* Primary action button */}
              {txLifecycle === 'idle' || txLifecycle === 'rejected' ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!writeReadiness.isReady}
                  aria-label={
                    writeReadiness.isReady
                      ? `Submit ${primaryAction ? formatActionLabel(primaryAction.type) : 'action'}`
                      : `${primaryAction ? formatActionLabel(primaryAction.type) : 'Action'} — ${writeReadiness.message ?? 'not ready'}`
                  }
                  aria-describedby={
                    !writeReadiness.isReady ? 'write-readiness-reason' : undefined
                  }
                  className={cn(
                    'w-full rounded-lg px-4 py-3 text-sm font-semibold transition-colors',
                    'min-h-[44px]',
                    writeReadiness.isReady
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                      : 'cursor-not-allowed bg-muted/40 text-ink-muted border border-border',
                  )}
                  data-testid="action-button"
                >
                  {primaryAction ? formatActionLabel(primaryAction.type) : 'Submit'}
                </button>
              ) : null}

              {/* Write readiness reason when not ready — Req 7.3 */}
              {!writeReadiness.isReady && (
                <div
                  id="write-readiness-reason"
                  role="status"
                  aria-live="polite"
                  className="mt-2 text-xs text-ink-muted"
                  data-testid="write-readiness-reason"
                >
                  {writeReadiness.message ?? 'Wallet or chain not ready.'}
                </div>
              )}

              {/* Transaction lifecycle states — Req 7.6 (pending → confirmed → finalized) */}
              {txLifecycle === 'pending' && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-3 text-sm text-pending"
                  data-testid="tx-pending"
                >
                  <span aria-hidden="true" className="mr-1">⏳</span>
                  Transaction pending…
                </div>
              )}

              {txLifecycle === 'confirmed' && txHash && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-3 flex items-center gap-2 text-sm text-confirmed"
                  data-testid="tx-confirmed"
                >
                  <span aria-hidden="true">✅</span>
                  Confirmed —{' '}
                  <SafeExternalLink
                    href={`${explorerBase}/tx/${txHash}`}
                    aria-label={`View confirmed transaction ${txHash.slice(0, 10)}… on block explorer (opens in new tab)`}
                    className="font-mono text-xs text-info underline hover:no-underline"
                  >
                    {txHash.slice(0, 10)}…
                    <span className="sr-only">(opens in new tab)</span>
                  </SafeExternalLink>
                </div>
              )}

              {txLifecycle === 'finalized' && txHash && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-3 flex items-center gap-2 text-sm text-finalized"
                  data-testid="tx-finalized"
                >
                  <span aria-hidden="true">🔒</span>
                  Finalized —{' '}
                  <SafeExternalLink
                    href={`${explorerBase}/tx/${txHash}`}
                    aria-label={`View finalized transaction ${txHash.slice(0, 10)}… on block explorer (opens in new tab)`}
                    className="font-mono text-xs text-info underline hover:no-underline"
                  >
                    {txHash.slice(0, 10)}…
                    <span className="sr-only">(opens in new tab)</span>
                  </SafeExternalLink>
                </div>
              )}
            </>
          )}
        </div>
      </ProtocolContractBoundary>
    </IntegrityBoundary>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatActionLabel(type: string): string {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Derive a default action list from the current phase when no override is
 * supplied. This is a projection — the real isCallable check should come from
 * the API/contract, not from phase alone. This fallback ensures the component
 * renders even before the real data is available.
 */
function deriveDefaultActions(phase: TimelinePhase, claimId: string): SettlementAction[] {
  const base = { claimId, isCallable: false, reason: 'Action not available in current phase.' };
  switch (phase) {
    case 'VERIFICATION_OPEN':
      return [{ ...base, type: 'SETTLE_PROVISIONAL', isCallable: false }];
    case 'VERIFICATION_CLOSED':
      return [{ ...base, type: 'SETTLE_PROVISIONAL', isCallable: true, reason: undefined }];
    case 'DISPUTED':
      return [{ ...base, type: 'SETTLE_APPEAL', isCallable: false }];
    case 'PENDING_SETTLEMENT':
      return [{ ...base, type: 'SETTLE_PROVISIONAL', isCallable: true, reason: undefined }];
    case 'SETTLED':
    case 'APPEAL_SETTLED':
      return [{ ...base, type: 'FINALIZE', isCallable: false, reason: 'Awaiting finalization window.' }];
    case 'PENDING_FINALIZATION':
      return [{ ...base, type: 'FINALIZE', isCallable: true, reason: undefined }];
    case 'FINALIZED':
      return [{ ...base, type: 'CLAIM_SETTLEMENT', isCallable: true, reason: undefined }];
    default:
      return [{ ...base, type: 'SETTLE_PROVISIONAL' }];
  }
}

export default ActionRail;
