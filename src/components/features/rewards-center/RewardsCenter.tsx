'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { Card, StatusBadge, TokenAmount } from '@/components/ui/primitives';
import { APP_ROUTES } from '@/config/navigation';
import { CenterFrame } from './CenterFrame';
import { TransactionReference } from './TransactionReference';
import {
  displayOutcome,
  rewardSourceLabel,
  REWARD_OUTCOMES,
  WITHDRAWAL_UNAVAILABLE,
  type CenterTransaction,
  type RewardsCenterData,
  type RewardOutcome,
} from './model';
import styles from './center.module.css';

const explanations: Record<RewardOutcome, string> = {
  accrued: 'Projected · not claimable',
  claimable: 'Requires a canonical ownership and eligibility read',
  pending: 'Withdrawal confirming · not settled',
  withdrawn: 'Lifetime finalized withdrawals',
  unavailable: 'Required canonical inputs unavailable',
  slashed: 'Contract-confirmed loss · excluded from claimable rewards',
};

export function RewardsCenter({
  data,
  transactions = [],
  recoveryUnavailable = false,
  onRefresh,
  refreshingDisabled,
}: {
  data: RewardsCenterData;
  transactions?: readonly CenterTransaction[];
  recoveryUnavailable?: boolean;
  onRefresh?: () => void;
  refreshingDisabled?: boolean;
}) {
  const [outcome, setOutcome] = useState('all');
  const filterId = useId();
  const reasonId = useId();
  const entries = data.entries.filter(
    (entry) => outcome === 'all' || displayOutcome(entry) === outcome,
  );
  return (
    <CenterFrame
      page="rewards"
      state={data.state}
      onRefresh={onRefresh}
      refreshingDisabled={refreshingDisabled}
    >
      <div className={styles.summary} aria-label="Reward outcomes">
        {REWARD_OUTCOMES.slice(0, 4).map((status) => {
          const matching = data.entries.filter(
            (entry) => displayOutcome(entry) === status,
          );
          return (
            <Card key={status} className="p-4 min-w-0">
              <h2 className="tb-small font-semibold capitalize">{status}</h2>
              <p className="mt-3 text-xl font-semibold">
                {matching.length === 1 && matching[0].amount !== null ? (
                  <TokenAmount amount={matching[0].amount} />
                ) : matching.length ? (
                  String(matching.length) + ' entries'
                ) : status === 'accrued' && data.state === 'empty' ? (
                  'No entries'
                ) : (
                  'Unavailable'
                )}
              </p>
              <p className="tb-small mt-2 text-ink-secondary">
                {matching.length === 1 && matching[0].amount !== null
                  ? 'Asset: ' + matching[0].asset + ' · '
                  : ''}
                {explanations[status]}
              </p>
            </Card>
          );
        })}
      </div>
      <div className={styles.columns}>
        <Card
          className="p-4 sm:p-6 min-w-0"
          role="region"
          aria-label="Reward entries"
        >
          <div className={styles.listHeader}>
            <h2 className="tb-section">Reward entries</h2>
            <div>
              <label htmlFor={filterId} className="tb-small mr-2">
                Outcome
              </label>
              <select
                id={filterId}
                className={styles.control}
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
              >
                <option value="all">All outcomes</option>
                {REWARD_OUTCOMES.map((status) => (
                  <option key={status} value={status}>
                    {status[0].toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="tb-small text-ink-secondary mt-2">
            Each amount retains its asset and source. Estimates never establish
            a withdrawable balance.
          </p>
          <p className="tb-small text-ink-secondary mt-2">
            {data.receivedAt
              ? `API response received ${new Date(data.receivedAt).toISOString()}. Chain freshness unknown.`
              : 'API freshness unavailable.'}
          </p>
          {data.rejectedCount > 0 && (
            <p role="alert" className="tb-small mt-3">
              Some projection entries were rejected as invalid. Displayed
              estimates are incomplete.
            </p>
          )}
          <div className="mt-4 space-y-3" aria-busy={data.state === 'loading'}>
            {entries.length === 0 ? (
              <p role="status" className="tb-small py-4">
                {data.state === 'loading'
                  ? 'Loading reward entries…'
                  : 'No entries for this outcome.'}
              </p>
            ) : (
              entries.map((entry) => (
                <article key={entry.id} className={styles.entry}>
                  <div className={styles.listHeader}>
                    <h3 className="font-semibold capitalize">{entry.title}</h3>
                    <StatusBadge
                      label={displayOutcome(entry)}
                      tone={
                        displayOutcome(entry) === 'slashed'
                          ? 'danger'
                          : displayOutcome(entry) === 'withdrawn'
                            ? 'finalized'
                            : 'neutral'
                      }
                    />
                  </div>
                  <p className="mt-3 break-all">
                    {entry.amount === null ? (
                      'Amount unavailable'
                    ) : (
                      <TokenAmount amount={entry.amount} />
                    )}
                  </p>
                  <p className="tb-small mt-2 break-all text-ink-secondary">
                    Asset: {entry.asset}
                  </p>
                  <p className="tb-small mt-2 text-ink-secondary">
                    {rewardSourceLabel(entry.source)}
                  </p>
                  <Link
                    className={styles.referenceLink}
                    href={APP_ROUTES.CLAIM_DETAIL(entry.claimId)}
                  >
                    View claim{' '}
                    <span className="break-all">{entry.claimId}</span>
                  </Link>
                </article>
              ))
            )}
          </div>
          <div className="mt-6 border-t border-divider pt-4">
            <button
              className={styles.control}
              type="button"
              disabled
              aria-describedby={reasonId}
            >
              Review withdrawal
            </button>
            <p id={reasonId} className="tb-small mt-3 text-ink-secondary">
              {WITHDRAWAL_UNAVAILABLE}
            </p>
          </div>
        </Card>
        <Card
          className="p-4 sm:p-6 min-w-0"
          role="region"
          aria-label="Pending authorization and recovery"
        >
          <h2 className="tb-section">Pending authorization</h2>
          <p className="tb-small mt-2 mb-4 text-ink-secondary">
            A hash or confirmation does not establish settled funds.
          </p>
          {transactions.length ? (
            transactions
              .slice(0, 2)
              .map((record) => (
                <TransactionReference key={record.id} record={record} />
              ))
          ) : (
            <p className="tb-small my-4">
              {recoveryUnavailable
                ? 'Browser recovery storage is unavailable. Keep any receipt references you already have.'
                : 'No saved transaction references in this browser.'}
            </p>
          )}
          <Link className={styles.control} href={APP_ROUTES.TRANSACTIONS}>
            Open transaction center
          </Link>
          <p className="tb-small mt-4 border-t border-divider pt-4 text-ink-secondary">
            Recovery states: rejected · replaced · reverted · reorged ·
            projection lag. A rejected signature creates no on-chain
            transaction.
          </p>
        </Card>
      </div>
    </CenterFrame>
  );
}
