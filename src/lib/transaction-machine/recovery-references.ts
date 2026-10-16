import { getPendingTransactions } from '@/lib/pending-transactions';
import { hydrateTxState, listPersistedTxIds } from './transaction-persistence';
import {
  isValidChain,
  createIdleState,
  type TransactionState,
} from './transaction-machine.types';

export { TRANSACTION_STORAGE_EVENT } from './transaction-persistence';
export interface CenterTransaction {
  id: string;
  label: string;
  state: TransactionState;
  source: 'local-reference' | 'canonical-adapter';
  authorization?: 'rejected';
  updatedAt: number;
}
const HASH = /^0x[0-9a-fA-F]{64}$/;

export function isTransactionHash(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && HASH.test(value);
}

/** Strict read boundary over the two existing stores. Never writes or resubmits.
 * Legacy entries carry no account/release binding, so all remain unverified
 * local references, including those with a saved "finalized" status.
 */
export function readRecoveryReferences(): CenterTransaction[] {
  const records: CenterTransaction[] = [];
  const hashes = new Set<string>();
  const contexts = listPersistedTxIds()
    .map((id) => ({ id, ctx: hydrateTxState(id) }))
    .sort(
      (a, b) =>
        (b.ctx?.updatedAt ?? 0) - (a.ctx?.updatedAt ?? 0) ||
        Number(b.ctx?.state.status === 'reorged') -
          Number(a.ctx?.state.status === 'reorged'),
    );
  for (const { id, ctx } of contexts) {
    if (
      !ctx ||
      ctx.id !== id ||
      !ctx.state.chainId ||
      !isValidChain(ctx.state.chainId)
    )
      continue;
    if (!Number.isFinite(ctx.updatedAt)) continue;
    if (ctx.state.txHash !== null && !isTransactionHash(ctx.state.txHash))
      continue;
    if (
      ctx.state.txHash === null &&
      !['idle', 'preparing', 'signature-requested', 'dropped'].includes(
        ctx.state.status,
      )
    )
      continue;
    if (
      ctx.state.replacedBy !== null &&
      !isTransactionHash(ctx.state.replacedBy)
    )
      continue;
    const key =
      String(ctx.state.chainId) +
      ':' +
      (ctx.state.txHash?.toLowerCase() ?? 'id:' + id);
    if (hashes.has(key)) continue;
    hashes.add(key);
    records.push({
      id,
      label: ctx.label.slice(0, 160),
      state: ctx.state,
      source: 'local-reference',
      updatedAt: ctx.updatedAt,
    });
  }
  for (const entry of getPendingTransactions()) {
    if (!entry.chainId || !isValidChain(entry.chainId)) continue;
    const unsigned =
      entry.txHash === null &&
      (entry.machineState === 'preparing' ||
        entry.machineState === 'signature-requested');
    if (!unsigned && !isTransactionHash(entry.txHash)) continue;
    if (!Number.isFinite(entry.createdAt)) continue;
    const key =
      String(entry.chainId) +
      ':' +
      (entry.txHash?.toLowerCase() ?? 'id:' + entry.id);
    if (hashes.has(key)) continue;
    hashes.add(key);
    // The lightweight registry lacks receipt/replacement evidence. Do not
    // reconstruct it from a saved status, confirmation count or timestamp.
    const state: TransactionState =
      entry.txHash === null
        ? {
            ...createIdleState(),
            chainId: entry.chainId,
            status:
              entry.machineState === 'signature-requested'
                ? 'signature-requested'
                : 'preparing',
          }
        : {
            status: 'submitted',
            txHash: entry.txHash,
            chainId: entry.chainId,
            blockNumber: null,
            confirmations: null,
            error: null,
            replacedBy: null,
          };
    records.push({
      id: entry.id,
      label:
        typeof entry.title === 'string'
          ? entry.title.slice(0, 160)
          : 'Saved transaction',
      state,
      source: 'local-reference',
      updatedAt: entry.createdAt,
    });
  }
  return records.sort(
    (a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id),
  );
}

export function isRecoveryStorageUnavailable(): boolean {
  try {
    return (
      typeof window === 'undefined' ||
      !Number.isSafeInteger(window.localStorage.length)
    );
  } catch {
    return true;
  }
}
