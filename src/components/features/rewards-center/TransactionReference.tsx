'use client';

import { TransactionStatus } from '@/components/features/claim-verification/TransactionStatus';
import { StatusBadge } from '@/components/ui/primitives';
import { getTransactionExplorerUrl } from '@/lib/explorer';
import { isValidChain } from '@/lib/transaction-machine/transaction-machine.types';
import { isTransactionHash } from '@/lib/transaction-machine/recovery-references';
import type { CenterTransaction } from './model';
import styles from './center.module.css';

function ReceiptLink({
  hash,
  chainId,
  label,
}: {
  hash: unknown;
  chainId: number | null;
  label: string;
}) {
  if (!isTransactionHash(hash) || chainId === null || !isValidChain(chainId))
    return null;
  const url = getTransactionExplorerUrl(hash, chainId);
  return (
    <a
      className={styles.referenceLink}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
    >
      {label} · {new URL(url).hostname} (opens in new tab)<code>{hash}</code>
    </a>
  );
}

export function TransactionReference({
  record,
}: {
  record: CenterTransaction;
}) {
  const { state } = record;
  const local = record.source === 'local-reference';
  const chain =
    state.chainId === 10
      ? 'Optimism Mainnet'
      : state.chainId === 11155420
        ? 'Optimism Sepolia'
        : 'Unsupported network';
  return (
    <article className={styles.entry} aria-label={record.label}>
      <h3 className="font-semibold break-words">{record.label}</h3>
      <p className="tb-small text-ink-secondary mt-2">
        {chain} · {local ? 'Local recovery reference' : 'Canonical adapter'}
      </p>
      {local ? (
        <div className="mt-3 space-y-2">
          <StatusBadge label="Reconciliation required" tone="warning" />
          <p className="tb-small">
            Saved state: {state.status}. This browser record is not evidence of
            confirmation, finality or account ownership.
          </p>
        </div>
      ) : (
        <div className={styles.canonicalStatus} data-state={state.status}>
          <TransactionStatus
            status={
              record.authorization === 'rejected' ? 'rejected' : state.status
            }
            messages={{
              safe: 'Confirmed on L2. Not finalized.',
              indexing:
                'Projection lag. Chain evidence is preserved while the API catches up.',
              confirming: 'Confirming. Funds are not presented as settled.',
            }}
          />
          {state.blockNumber !== null && (
            <p className="tb-small mt-2">
              Receipt block {String(state.blockNumber)}
            </p>
          )}
          {state.confirmations !== null && (
            <p className="tb-small">
              {state.confirmations} confirmations · confirmation count alone
              does not establish finality
            </p>
          )}
        </div>
      )}
      <details className="mt-3">
        <summary className={styles.control}>
          Recovery details for {record.label}
        </summary>
        <div className="mt-3 space-y-3">
          <p className="tb-small">
            Recovery reference: <code className="break-all">{record.id}</code>
          </p>
          <p className="tb-small text-ink-secondary">
            Account and release must be revalidated. Keep these references when
            reconnecting or changing wallets. Refresh only rereads saved
            references; it never signs, retries or resubmits a transaction.
          </p>
          {state.status === 'reorged' && (
            <p className="tb-small">
              Reorg recovery: prior confirmation must be reconciled against the
              canonical chain before any outcome is trusted.
            </p>
          )}
          {state.status === 'dropped' && (
            <p className="tb-small">
              Dropped recovery: check the nonce and canonical receipt before
              considering a new submission.
            </p>
          )}
          <ReceiptLink
            hash={state.txHash}
            chainId={state.chainId}
            label={
              state.replacedBy
                ? 'Original transaction'
                : 'View transaction receipt'
            }
          />
          {state.replacedBy && (
            <ReceiptLink
              hash={state.replacedBy}
              chainId={state.chainId}
              label="Follow replacement transaction"
            />
          )}
        </div>
      </details>
    </article>
  );
}
