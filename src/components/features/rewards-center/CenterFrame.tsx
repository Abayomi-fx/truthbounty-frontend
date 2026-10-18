'use client';

import Link from 'next/link';
import { useId, type ReactNode } from 'react';
import { AsyncStatus } from '@/components/ui/AsyncStatus';
import { APP_ROUTES } from '@/config/navigation';
import type { CenterState } from './model';
import styles from './center.module.css';

const stateCopy: Record<Exclude<CenterState, 'ready'>, string> = {
  loading:
    'Loading references. No balance or outcome is assumed while reads are pending.',
  empty:
    'No reward entries returned. Canonical balances remain unavailable until verified by a pinned adapter.',
  stale:
    'Stale API projection. Estimates may be out of date and cannot authorize a withdrawal.',
  offline:
    'Offline. Saved references remain available; reconnect before checking chain or projection state.',
  unavailable:
    'Data unavailable. Required provider, release or adapter inputs cannot be verified.',
  error:
    'Reward projection could not be loaded. Retry the read; no transaction will be submitted.',
  denied:
    'Connect the intended wallet on the pinned Optimism release network to read rewards. Connection does not authorize withdrawals.',
  'not-found':
    'Requested reward reference was not found. Return to all reward entries or inspect saved transactions.',
};

export function CenterFrame({
  page,
  state,
  onRefresh,
  refreshingDisabled,
  children,
}: {
  page: 'rewards' | 'transactions';
  state: CenterState;
  onRefresh?: () => void;
  refreshingDisabled?: boolean;
  children: ReactNode;
}) {
  const refreshReasonId = useId();
  return (
    <section
      className={styles.center}
      aria-label={page === 'rewards' ? 'Rewards center' : 'Transaction center'}
    >
      <header className={styles.header}>
        <div>
          <p className="tb-small font-semibold text-info">Claimant finances</p>
          <h1 className="tb-title mt-2">
            {page === 'rewards'
              ? 'Rewards and transaction recovery'
              : 'Transaction center'}
          </h1>
          <p className="tb-small mt-2 text-ink-secondary">
            Balances and mutations remain separated by canonical state.
          </p>
        </div>
        {onRefresh && (
          <button
            type="button"
            className={styles.control}
            disabled={refreshingDisabled}
            aria-describedby={refreshingDisabled ? refreshReasonId : undefined}
            onClick={onRefresh}
          >
            Refresh references
          </button>
        )}
      </header>
      {refreshingDisabled && (
        <p id={refreshReasonId} className="tb-small text-ink-secondary">
          Reference refresh is unavailable while the wallet, network or read is
          pending. Saved recovery references are preserved.
        </p>
      )}
      <nav aria-label="Rewards and transactions" className={styles.navigation}>
        <Link
          href={APP_ROUTES.REWARDS}
          aria-current={page === 'rewards' ? 'page' : undefined}
        >
          Rewards
        </Link>
        <Link
          href={APP_ROUTES.TRANSACTIONS}
          aria-current={page === 'transactions' ? 'page' : undefined}
        >
          Transactions
        </Link>
      </nav>
      {state !== 'ready' && (
        <div className={styles.notice}>
          <AsyncStatus
            status={
              state === 'error'
                ? 'error'
                : state === 'loading'
                  ? 'loading'
                  : state === 'stale'
                    ? 'stale'
                    : 'empty'
            }
            message={stateCopy[state]}
          />
        </div>
      )}
      {children}
    </section>
  );
}
