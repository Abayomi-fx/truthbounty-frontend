/**
 * UI-FE-088 — typed transaction and finality factories.
 *
 * Contract/chain-derived values only: block numbers, receipts, and hashes are
 * bigints and `0x` strings exactly as the pinned types in
 * `src/app/types/transaction.ts` and `src/app/types/finality.ts` require.
 *
 * Finality results are *derived* with the production `deriveFinalityLevel`
 * rather than hand-written, so a fixture can never claim a level the canonical
 * derivation would reject.
 */

import type {
  Transaction,
  TransactionFailed,
  TransactionStateName,
} from '../../../app/types/transaction';
import type { FinalityContext, FinalityLevel, FinalityResult } from '../../../app/types/finality';
import { deriveFinalityLevel } from '../../../app/types/finality';
import { createFixtureContext, type FixtureContext } from '../deterministic';

/** Address literal viem's `Address` type accepts (checksum-agnostic fixture). */
type TxAddress = `0x${string}`;

type ReceiptLog = { address: TxAddress; topics: string[]; data: string };

/** Deterministic receipt logs (topic words are fixed-width hex). */
function receiptLogs(address: TxAddress, count: number): ReceiptLog[] {
  return Array.from({ length: count }, (_unused, index) => ({
    address,
    topics: [
      `0x${(index + 1).toString(16).padStart(64, '0')}`,
      `0x${(index + 2).toString(16).padStart(64, '0')}`,
    ],
    data: `0x${(index + 3).toString(16).padStart(64, '0')}`,
  }));
}

export interface MakeTransactionOptions {
  /** Claim id used to derive addresses and hashes. */
  claimId?: string;
  ctx?: FixtureContext;
}

interface TransactionBaseFields {
  hash: `0x${string}`;
  fromAddress: TxAddress;
  toAddress: TxAddress;
  chainId: number;
  timestamp: number;
  amount: string;
  data: `0x${string}`;
  blockNumber: bigint;
  blockHash: `0x${string}`;
  transactionIndex: number;
  confirmations: number;
}

function baseFields(
  claimId: string,
  ctx: FixtureContext,
  overrides: Partial<TransactionBaseFields> = {},
): TransactionBaseFields {
  return {
    hash: ctx.hex(`tx:${claimId}`, 32),
    fromAddress: ctx.address(`tx-from:${claimId}`),
    toAddress: ctx.address('truthbounty-contract'),
    chainId: 11155420,
    timestamp: Math.floor(ctx.nowMs / 1000),
    amount: (BigInt(ctx.int(`tx-amount:${claimId}`, 1, 900)) * 10n ** 15n).toString(),
    data: '0x',
    blockNumber: BigInt(ctx.int(`tx-block:${claimId}`, 6_100_000, 6_199_000)),
    blockHash: ctx.hex(`tx-blockhash:${claimId}`, 32),
    transactionIndex: ctx.int(`tx-index:${claimId}`, 0, 180),
    confirmations: ctx.int(`tx-confirmations:${claimId}`, 1, 40),
    ...overrides,
  };
}

function receipt(
  status: 'success' | 'reverted' | 'failed',
  ctx: FixtureContext,
  claimId: string,
) {
  return {
    status,
    gasUsed: BigInt(ctx.int(`gas-used:${claimId}`, 45_000, 300_000)),
    cumulativeGasUsed: BigInt(ctx.int(`cumulative-gas:${claimId}`, 300_000, 900_000)),
    logs: receiptLogs(ctx.address('truthbounty-contract'), 2),
  };
}

export type MakeTransactionKind =
  | TransactionStateName
  | 'reverted'
  | 'replaced';

/**
 * Build a transaction for a canonical lifecycle state.
 *
 * `reverted` → `TransactionFailed` with `state: 'reverted'` and a reverted receipt.
 * `replaced` → `TransactionFailed` with `reason: 'nonce-too-low'`, the code path
 * the app sees when a same-nonce replacement lands first.
 */
export function makeTransaction(
  kind: MakeTransactionKind = 'confirmed',
  options: MakeTransactionOptions = {},
): Transaction {
  const { claimId = 'claim-0001', ctx = createFixtureContext() } = options;
  const base = baseFields(claimId, ctx);

  switch (kind) {
    case 'submitted':
      return {
        state: 'submitted',
        hash: base.hash,
        fromAddress: base.fromAddress,
        toAddress: base.toAddress,
        chainId: base.chainId,
        timestamp: base.timestamp,
        amount: base.amount,
        data: base.data,
        confirmations: 0,
        nonce: ctx.int(`nonce:${claimId}`, 1, 64),
      };
    case 'confirmed':
      return {
        state: 'confirmed',
        ...base,
        receipt: receipt('success', ctx, claimId),
      };
    case 'safe':
      return {
        state: 'safe',
        ...base,
        receipt: receipt('success', ctx, claimId),
        safeBlockNumber: base.blockNumber + 1n,
      };
    case 'finalized':
      return {
        state: 'finalized',
        ...base,
        receipt: receipt('success', ctx, claimId),
        finalizedBlockNumber: base.blockNumber + 128n,
        l1TransactionHash: ctx.hex(`l1-tx:${claimId}`, 32),
        l1BlockNumber: base.blockNumber + 128n,
      };
    case 'indexing':
      return {
        state: 'indexing',
        ...base,
        receipt: receipt('success', ctx, claimId),
        finalizedBlockNumber: base.blockNumber + 128n,
        l1TransactionHash: ctx.hex(`l1-tx:${claimId}`, 32),
        l1BlockNumber: base.blockNumber + 128n,
        indexingProgress: ctx.int(`indexing-progress:${claimId}`, 10, 85),
      };
    case 'indexed':
      return {
        state: 'indexed',
        ...base,
        receipt: receipt('success', ctx, claimId),
        finalizedBlockNumber: base.blockNumber + 128n,
        l1TransactionHash: ctx.hex(`l1-tx:${claimId}`, 32),
        l1BlockNumber: base.blockNumber + 128n,
        indexedAt: Math.floor(ctx.nowMs / 1000) - 30,
      };
    case 'reverted':
      return {
        state: 'reverted',
        chainId: base.chainId,
        timestamp: base.timestamp,
        hash: base.hash,
        fromAddress: base.fromAddress,
        toAddress: base.toAddress,
        reason: 'revert',
        error: 'execution reverted: fixture revert reason',
        receipt: {
          status: 'reverted',
          gasUsed: BigInt(ctx.int(`revert-gas:${claimId}`, 45_000, 300_000)),
          cumulativeGasUsed: BigInt(ctx.int(`revert-cumulative:${claimId}`, 300_000, 900_000)),
          logs: [],
        },
      } satisfies TransactionFailed;
    case 'replaced':
      return {
        state: 'failed',
        chainId: base.chainId,
        timestamp: base.timestamp,
        hash: base.hash,
        fromAddress: base.fromAddress,
        toAddress: base.toAddress,
        reason: 'nonce-too-low',
        error: 'transaction was replaced by a same-nonce transaction',
      } satisfies TransactionFailed;
    case 'failed':
      return {
        state: 'failed',
        chainId: base.chainId,
        timestamp: base.timestamp,
        reason: 'network-error',
        error: 'fixture network failure',
      } satisfies TransactionFailed;
    default: {
      const exhaustive: never = kind;
      throw new Error(`makeTransaction: unknown kind "${String(exhaustive)}"`);
    }
  }
}

export type FinalityScenario = Extract<FinalityLevel, 'observed' | 'safe' | 'finalized' | 'reorged'>;

export interface MakeFinalityContextOptions {
  claimId?: string;
  /** Receipt status; `0x0` means the transaction reverted on chain. */
  receiptStatus?: '0x1' | '0x0';
  ctx?: FixtureContext;
}

/**
 * Build the minimal on-chain context that derives `level`.
 * Reorged contexts carry a stale previous observation whose receipt vanished,
 * which is exactly how the production derivation detects a reorganisation.
 */
export function makeFinalityContext(
  level: FinalityScenario,
  options: MakeFinalityContextOptions = {},
): FinalityContext {
  const { claimId = 'claim-0001', receiptStatus = '0x1', ctx = createFixtureContext() } = options;
  const txBlock = BigInt(ctx.int(`finality-block:${claimId}`, 6_100_000, 6_199_000));
  const latest = txBlock + 40n;
  const blockHash = ctx.hex(`finality-blockhash:${claimId}`, 32);

  const heads: FinalityContext['headBlockNumbers'] =
    level === 'observed'
      ? { latest }
      : level === 'safe'
        ? { latest, safe: latest - 4n }
        : { latest, safe: latest - 4n, finalized: latest - 32n };

  const context: FinalityContext = {
    txHash: ctx.hex(`finality-tx:${claimId}`, 32),
    chainId: 11155420,
    blockNumber: txBlock,
    receiptStatus,
    blockHash,
    receiptPresent: true,
    headBlockNumbers: heads,
  };

  if (level === 'reorged') {
    return {
      ...context,
      receiptPresent: false,
      previousObservation: {
        blockNumber: txBlock,
        blockHash: ctx.hex(`finality-stale-blockhash:${claimId}`, 32),
      },
    };
  }

  return context;
}

/** Derive the canonical `FinalityResult` for a fixture context. */
export function makeFinality(
  level: FinalityScenario,
  options: MakeFinalityContextOptions = {},
): FinalityResult {
  return deriveFinalityLevel(makeFinalityContext(level, options));
}
