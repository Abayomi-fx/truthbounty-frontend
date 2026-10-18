import type { CenterTransaction, RewardsCenterData } from '../model';
import {
  createIdleState,
  type TransactionState,
  type TransactionStatus,
} from '@/lib/transaction-machine/transaction-machine.types';

// Illustrative values are confined to this test-only directory.
export const HASH = ('0x' + 'ab'.repeat(32)) as `0x${string}`;
export const REPLACEMENT = ('0x' + 'cd'.repeat(32)) as `0x${string}`;
export const receivedAt = Date.parse('2026-10-15T12:00:00Z');

export const rewardsFixture: RewardsCenterData = {
  state: 'ready',
  receivedAt,
  rejectedCount: 0,
  entries: [
    {
      id: 'estimate',
      claimId: HASH,
      title: 'Claim settlement',
      outcome: 'accrued',
      amount: '64.20',
      asset: 'USDC · illustrative asset',
      source: { kind: 'api-projection', receivedAt, freshness: 'unknown' },
    },
    {
      id: 'claimable',
      claimId: HASH,
      title: 'Verifier reward',
      outcome: 'claimable',
      amount: '42.80',
      asset: 'USDC · illustrative asset',
      source: { kind: 'contract', block: '14282901', finality: 'finalized' },
    },
    {
      id: 'pending',
      claimId: HASH,
      title: 'Withdrawal pending',
      outcome: 'pending',
      amount: '12.00',
      asset: 'USDC · illustrative asset',
      source: { kind: 'contract', block: '14282902', finality: 'confirmed' },
    },
    {
      id: 'withdrawn',
      claimId: HASH,
      title: 'Finalized withdrawal',
      outcome: 'withdrawn',
      amount: '318.50',
      asset: 'USDC · illustrative asset',
      source: { kind: 'contract', block: '14281443', finality: 'finalized' },
    },
    {
      id: 'unavailable',
      claimId: HASH,
      title: 'Unavailable allocation',
      outcome: 'unavailable',
      amount: null,
      asset: 'Asset metadata unavailable',
      source: {
        kind: 'api-projection',
        receivedAt: null,
        freshness: 'unknown',
      },
    },
    {
      id: 'slashed',
      claimId: HASH,
      title: 'Slashed stake',
      outcome: 'slashed',
      amount: '5.00',
      asset: 'USDC · illustrative asset',
      source: { kind: 'contract', block: '14281443', finality: 'finalized' },
    },
  ],
};

export function transactionFixture(
  status: TransactionStatus = 'submitted',
  source: CenterTransaction['source'] = 'canonical-adapter',
): CenterTransaction {
  const state = {
    ...createIdleState(),
    status,
    chainId: 11155420,
    txHash: ['idle', 'preparing', 'signature-requested'].includes(status)
      ? null
      : HASH,
    blockNumber: [
      'confirming',
      'safe',
      'indexing',
      'finalized',
      'reverted',
    ].includes(status)
      ? 14282901n
      : null,
    confirmations: ['confirming', 'safe', 'indexing', 'finalized'].includes(
      status,
    )
      ? 3
      : null,
    replacedBy: status === 'replaced' ? REPLACEMENT : null,
    error:
      status === 'reorged'
        ? 'REORG'
        : status === 'reverted'
          ? 'REVERT'
          : status === 'dropped'
            ? 'DROPPED'
            : null,
  } as TransactionState;
  return {
    id: 'withdrawal:' + status,
    label: 'Withdraw 12.00 USDC',
    state,
    source,
    updatedAt: receivedAt,
  };
}
