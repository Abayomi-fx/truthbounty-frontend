'use client';

import { Card } from '@/components/ui/primitives';
import { CenterFrame } from './CenterFrame';
import { TransactionReference } from './TransactionReference';
import type { CenterState, CenterTransaction } from './model';
import styles from './center.module.css';

export function TransactionCenter({
  records,
  state = 'ready',
  onRefresh,
}: {
  records: readonly CenterTransaction[];
  state?: CenterState;
  onRefresh?: () => void;
}) {
  return (
    <CenterFrame page="transactions" state={state} onRefresh={onRefresh}>
      <div className={styles.notice}>
        <p className="tb-small">
          Saved references survive reload and reconnect on this browser. Local
          storage is untrusted and may be unavailable or cleared. No record is
          automatically signed, retried or resubmitted. Legacy references are
          not scoped to the active wallet or release.
        </p>
      </div>
      <Card
        className="p-4 sm:p-6"
        role="region"
        aria-label="Persisted transactions"
      >
        <h2 className="tb-section">Persisted transactions</h2>
        <div className="mt-4 space-y-4">
          {records.length ? (
            records.map((record) => (
              <TransactionReference key={record.id} record={record} />
            ))
          ) : (
            <p role="status">
              {state === 'loading'
                ? 'Loading saved references…'
                : 'No saved transaction references in this browser.'}
            </p>
          )}
        </div>
      </Card>
    </CenterFrame>
  );
}
