/**
 * V2-FE-051 — Accessible lifecycle copy for the shared transaction state machine.
 *
 * Messages are driven by machine status only. They never invent hashes,
 * receipts, or finality; recovery language is offered for terminal failure.
 */

import type { TransactionStatus } from './transaction-machine.types';

export type LifecycleTone = 'neutral' | 'success' | 'warning' | 'danger';

const MESSAGES: Record<TransactionStatus, string> = {
  idle: 'No transaction in progress.',
  preparing: 'Preparing transaction. Validating network and parameters.',
  'signature-requested':
    'Waiting for wallet signature. Review the request carefully, then approve or reject.',
  submitted:
    'Transaction submitted. Awaiting a canonical on-chain receipt — this is not final.',
  confirming:
    'Canonical receipt observed. Waiting for confirmations before treating the result as safe.',
  safe: 'Transaction is safe on the configured finality policy. Awaiting finalization or indexing.',
  indexing: 'Indexing on-chain projection. Waiting for backend acknowledgement.',
  finalized: 'Transaction finalized. Result is durable under the configured finality policy.',
  dropped:
    'Transaction dropped from the mempool without a canonical receipt. You can retry safely.',
  replaced:
    'Transaction was replaced by another hash. Follow the replacement; do not treat the original as final.',
  reverted:
    'Transaction reverted on-chain. Review the error and retry when ready.',
  reorged:
    'Previously observed receipt was orphaned by a reorganization. Success has been cleared — reconcile and retry if needed.',
};

const TONES: Record<TransactionStatus, LifecycleTone> = {
  idle: 'neutral',
  preparing: 'neutral',
  'signature-requested': 'neutral',
  submitted: 'neutral',
  confirming: 'neutral',
  safe: 'success',
  indexing: 'neutral',
  finalized: 'success',
  dropped: 'warning',
  replaced: 'warning',
  reverted: 'danger',
  reorged: 'danger',
};

export function getTransactionLifecycleMessage(
  status: TransactionStatus,
): string {
  return MESSAGES[status];
}

export function getTransactionLifecycleTone(
  status: TransactionStatus,
): LifecycleTone {
  return TONES[status];
}

/** True when UI must offer an explicit recovery action (retry / reconcile). */
export function needsLifecycleRecovery(status: TransactionStatus): boolean {
  return (
    status === 'dropped' ||
    status === 'replaced' ||
    status === 'reverted' ||
    status === 'reorged'
  );
}
