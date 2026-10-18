'use client';

import React, { useSearchParams } from 'react';
import {
  TransactionItem,
  type TransactionItemProps,
} from '@/components/transactions/transaction-item';
import { StatusCard } from '@/components/transactions/status-card';
import { ConfidenceMeter } from '@/components/ui/primitives/ConfidenceMeter';
import { OutcomeBadge } from '@/components/ui/primitives/OutcomeBadge';

/**
 * Deterministic, production-excluded harness that renders the transaction
 * components across every status they implement (pending / confirming /
 * confirmed / failed). Playwright drives this route to assert each state
 * renders accessibly. Fixtures are static and carry no real chain data — no
 * transaction outcome is fabricated for a real user session.
 */
const TRANSACTION_FIXTURES: TransactionItemProps[] = [
  {
    type: 'verification',
    status: 'pending',
    title: 'Verification submitted',
    description: 'Awaiting inclusion in the mempool',
    amount: '0.50 OP',
    timeAgo: 'just now',
    hash: '0xpending00000000000000000000000000000000000000000000000000000dead',
  },
  {
    type: 'stake',
    status: 'confirming',
    title: 'Stake confirming',
    description: 'Included in a block, awaiting confirmations',
    amount: '10.00 OP',
    timeAgo: '30s ago',
    progress: 40,
    hash: '0xconfirming000000000000000000000000000000000000000000000000beef',
  },
  {
    type: 'withdrawal',
    status: 'confirmed',
    title: 'Withdrawal confirmed',
    description: 'Confirmed on Optimism',
    amount: '2.00 OP',
    timeAgo: '2m ago',
    hash: '0xconfirmed0000000000000000000000000000000000000000000000000cafe',
  },
  {
    type: 'dispute',
    status: 'failed',
    title: 'Dispute reverted',
    description: 'Transaction reverted on-chain',
    amount: '1.00 OP',
    timeAgo: '5m ago',
    errorMessage: 'execution reverted: insufficient stake',
    hash: '0xfailed000000000000000000000000000000000000000000000000000f00d1',
  },
];

const STATUS_SUMMARY = [
  { status: 'pending' as const, count: 1 },
  { status: 'confirming' as const, count: 1 },
  { status: 'confirmed' as const, count: 1 },
  { status: 'failed' as const, count: 1 },
];

const APPEAL_ROUNDS = [
  {
    round: 1,
    status: 'Open',
    deadline: '2026-01-20T12:00:00Z',
  },
  {
    round: 2,
    status: 'Escalated',
    escalationStatus: 'Escalation pending',
  },
  {
    round: 3,
    status: 'Resolved',
    outcome: 'upheld',
  },
  {
    round: 4,
    status: 'Stale',
    staleReason: 'Appeal data may be out of date',
  },
];

const VERIFICATION_OUTCOMES = [
  { kind: 'verified' as const, provisional: false, source: 'Canonical Projection' },
  { kind: 'disputed' as const, provisional: false, source: 'Canonical Projection' },
  { kind: 'appealed' as const, provisional: true, source: 'Canonical Projection' },
  { kind: 'inconclusive' as const, provisional: false, source: 'Canonical Projection' },
];

export function TransactionStatesHarness() {
  const searchParams = useSearchParams();
  const confidenceMode = searchParams.get('confidence') ?? 'available';
  const [lastCopied, setLastCopied] = React.useState<string | null>(null);
  const [lastRetried, setLastRetried] = React.useState<string | null>(null);

  return (
    <main id="e2e-transaction-states" className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-bold text-white">
        Transaction states (E2E harness)
      </h1>

      <section aria-label="Status summary" className="mb-8 flex flex-wrap gap-4">
        {STATUS_SUMMARY.map(item => (
          <StatusCard key={item.status} status={item.status} count={item.count} />
        ))}
      </section>

      {/* Confidence Score Visualization */}
      <section aria-label="Confidence" className="mb-8">
        <h2 className="mb-4 text-xl font-bold text-white">Confidence Score</h2>
        {confidenceMode === 'available' ? (
          <ConfidenceMeter
            value={85}
            label="Confidence Score"
            source="Canonical Projection"
            computedAt="2026-01-15T10:30:00.000Z"
            provisional={false}
            showValue={true}
            showBandLabel={true}
          />
        ) : confidenceMode === 'stale' ? (
          <div role="region" aria-label="Confidence" className="space-y-2">
            <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4">
              <p className="text-orange-400">Confidence data may be out of date.</p>
              <p className="mt-1 text-sm text-orange-300">Stale projection — not a fresh score.</p>
              <button
                className="mt-3 px-3 py-1.5 rounded bg-orange-500/20 text-orange-300 hover:bg-orange-500/30"
              >
                Refresh
              </button>
            </div>
          </div>
        ) : (
          <div role="region" aria-label="Confidence" className="space-y-2">
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
              <p className="text-destructive">Confidence data unavailable.</p>
              <p className="mt-1 text-sm text-destructive/90">Cannot retrieve confidence projection.</p>
              <button
                className="mt-3 px-3 py-1.5 rounded bg-destructive/20 text-destructive hover:bg-destructive/30"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Verification Outcomes */}
      <section aria-label="Verification Outcomes" className="mb-8">
        <h2 className="mb-4 text-xl font-bold text-white">Verification Outcomes</h2>
        <div role="region" aria-label="Verification Outcomes" className="space-y-3">
          <p id="verification-outcome-status" role="status" aria-live="polite" className="sr-only">
            Verification outcome: Verified
          </p>
          <div className="flex flex-wrap gap-2">
            {VERIFICATION_OUTCOMES.map((outcome, idx) => (
              <OutcomeBadge
                key={idx}
                kind={outcome.kind}
                provisional={outcome.provisional}
                source={outcome.source}
                compact
              />
            ))}
          </div>
        </div>
      </section>

      {/* Appeal Rounds */}
      <section aria-label="Appeal Rounds" className="mb-8 space-y-4">
        <h2 className="mb-4 text-xl font-bold text-white">Appeal Rounds</h2>
        {APPEAL_ROUNDS.map((appeal, idx) => (
          <div
            key={idx}
            role="region"
            aria-label={`Appeal round ${appeal.round}`}
            className="rounded-lg border border-slate-700 bg-slate-900/50 p-4"
          >
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-medium">Appeal round {appeal.round}</span>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  appeal.status === 'Open'
                    ? 'bg-green-500/20 text-green-400'
                    : appeal.status === 'Escalated'
                    ? 'bg-amber-500/20 text-amber-400'
                    : appeal.status === 'Resolved'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-orange-500/20 text-orange-400'
                }`}
              >
                {appeal.status}
              </span>
            </div>
            {appeal.deadline && (
              <p className="text-sm text-slate-400">Deadline: {new Date(appeal.deadline).toLocaleString()}</p>
            )}
            {appeal.escalationStatus && (
              <p className="text-sm text-amber-400">{appeal.escalationStatus}</p>
            )}
            {appeal.outcome && (
              <p className="text-sm text-green-400">Outcome: {appeal.outcome}</p>
            )}
            {appeal.staleReason && (
              <>
                <p className="text-sm text-orange-400">{appeal.staleReason}</p>
                <button className="mt-2 px-3 py-1.5 rounded bg-orange-500/20 text-orange-300 hover:bg-orange-500/30">
                  Refresh
                </button>
              </>
            )}
          </div>
        ))}
      </section>

      <section aria-label="Transactions" className="space-y-4">
        {TRANSACTION_FIXTURES.map(transaction => (
          <TransactionItem
            key={transaction.hash}
            {...transaction}
            onCopy={hash => setLastCopied(hash)}
            onRetry={
              transaction.status === 'failed'
                ? () => setLastRetried(transaction.hash)
                : undefined
            }
          />
        ))}
      </section>

      {/* Test-only affordances so Playwright can assert handler wiring. */}
      <p data-testid="last-copied" hidden>
        {lastCopied ?? ''}
      </p>
      <p data-testid="last-retried" hidden>
        {lastRetried ?? ''}
      </p>
    </main>
  );
}