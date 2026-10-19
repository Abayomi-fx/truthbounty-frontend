'use client';

import React from 'react';
import {
  GUARDIAN_AUTHORITY_LABELS,
  type GuardianAuthorityStatus,
  type GuardianPauseSnapshot,
} from '@/lib/guardian';

const STATUS_TONE: Record<GuardianAuthorityStatus, string> = {
  ready: 'text-emerald-500',
  manifest_unverified: 'text-amber-500',
  unsupported_chain: 'text-amber-500',
  wrong_network: 'text-amber-500',
  no_abi_pause_support: 'text-amber-500',
  wallet_disconnected: 'text-muted-foreground',
  authority_unread: 'text-amber-500',
  authority_revoked: 'text-destructive',
  authority_unknown: 'text-destructive',
  stale_data: 'text-amber-500',
};

export interface GuardianPauseStatusProps {
  snapshot: GuardianPauseSnapshot;
  compact?: boolean;
}

/**
 * Accessible status surface for guardian pause authority. Renders only values
 * derived from the pinned manifest/ABI and canonical reads — never fabricated.
 */
export function GuardianPauseStatus({
  snapshot,
  compact = false,
}: GuardianPauseStatusProps) {
  const label = GUARDIAN_AUTHORITY_LABELS[snapshot.status];
  const isBlocking = !snapshot.allowsPause;

  return (
    <div
      data-testid="guardian-pause-status"
      data-status={snapshot.status}
      data-allows-pause={snapshot.allowsPause ? 'true' : 'false'}
      role="status"
      aria-live="polite"
      className={
        compact
          ? 'flex flex-col gap-1 text-sm'
          : 'rounded-xl border border-border bg-card p-4 text-sm'
      }
    >
      <p className="font-semibold text-foreground">
        <span className="sr-only">Guardian authority: </span>
        <span className={STATUS_TONE[snapshot.status]}>{label}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        <span className="sr-only">Connected chain: </span>
        Chain {snapshot.chainId}
        {snapshot.provenance.releaseChainId !== null
          ? ` · release chain ${snapshot.provenance.releaseChainId}`
          : ' · release chain unknown'}
        {snapshot.provenance.observedAtBlock !== null
          ? ` · block ${String(snapshot.provenance.observedAtBlock)}`
          : ''}
      </p>
      {!compact && (
        <p className="mt-1 font-mono text-xs text-muted-foreground break-all">
          <span className="sr-only">Canonical guardian address: </span>
          Guardian: {snapshot.guardianAddress ?? 'unread'} · Account:{' '}
          {snapshot.account ?? 'disconnected'}
        </p>
      )}
      {!compact && (
        <p className="mt-1 text-xs text-muted-foreground" data-testid="guardian-abi-proofs">
          ABI-proven pause scopes:{' '}
          {snapshot.provenance.pauseProofs.length === 0
            ? 'none'
            : snapshot.provenance.pauseProofs
                .map((proof) => `${proof.scope} (${proof.signature})`)
                .join(', ')}
        </p>
      )}
      {isBlocking && snapshot.blockingReasons.length > 0 && (
        <ul
          className="mt-2 list-disc pl-5 text-amber-400"
          aria-label="Blocking reasons"
          data-testid="guardian-blocking-reasons"
        >
          {snapshot.blockingReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default GuardianPauseStatus;
