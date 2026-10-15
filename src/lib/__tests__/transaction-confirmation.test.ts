/**
 * V2-FE Transaction Confirmation Unit Tests
 *
 * Coverage:
 * - Confirmation calculation (valid inputs, edge cases, fail-closed behavior)
 * - Finality checks (threshold comparisons for safe/finalized)
 * - Finality level determination (none/safe/finalized)
 * - Finality guards (canShowDurableSuccess, canShowProvisionalSuccess, shouldWithholdSuccess)
 * - Time estimates (safe/finalized, based on block time)
 * - Time formatting (seconds, minutes, hours)
 * - Polling intervals (state-based, terminal states)
 * - Progress calculation (percentage, clamping)
 * - Validation (confirmation count consistency, state transitions)
 * - Chain-specific thresholds (Optimism, OP Sepolia, Hardhat, unknown chains)
 *
 * Security invariants:
 * - Never fabricates confirmation counts
 * - Fail closed on invalid inputs (negative blocks, null values)
 * - Unknown chains return null/false (no assumptions)
 * - All guards enforce multi-condition checks
 */

import {
  CONFIRMATION_THRESHOLDS,
  calculateConfirmations,
  getConfirmationsFromState,
  isSafeConfirmations,
  isFinalizedConfirmations,
  getFinalityLevel,
  canShowDurableSuccess,
  canShowProvisionalSuccess,
  shouldWithholdSuccess,
  estimateTimeToSafe,
  estimateTimeToFinalized,
  formatTimeEstimate,
  getPollingInterval,
  shouldPoll,
  calculateConfirmationProgress,
  getProgressTarget,
  isConfirmationCountValid,
  isConfirmationTransitionValid,
} from '@/lib/transaction-confirmation';

import type { TransactionState } from '@/lib/transaction-machine/transaction-machine.types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const createState = (
  status: TransactionState['status'],
  overrides: Partial<TransactionState> = {}
): TransactionState => {
  const base = {
    status,
    txHash: status !== 'idle' ? ('0xabc' as `0x${string}`) : null,
    chainId: status !== 'idle' ? 10 : null,
    blockNumber: null,
    confirmations: null,
    error: null,
    replacedBy: null,
  };

  return { ...base, ...overrides } as TransactionState;
};

// ---------------------------------------------------------------------------
// Confirmation calculation
// ---------------------------------------------------------------------------

describe('calculateConfirmations', () => {
  it('calculates confirmations correctly: (current - tx) + 1', () => {
    expect(calculateConfirmations(100n, 100n)).toBe(1);
    expect(calculateConfirmations(100n, 101n)).toBe(2);
    expect(calculateConfirmations(100n, 112n)).toBe(13);
  });

  it('returns 0 for invalid inputs (fail-closed)', () => {
    expect(calculateConfirmations(null, 100n)).toBe(0);
    expect(calculateConfirmations(100n, null)).toBe(0);
    expect(calculateConfirmations(null, null)).toBe(0);
  });

  it('returns 0 when current block is before tx block (invalid state)', () => {
    expect(calculateConfirmations(100n, 99n)).toBe(0);
  });

  it('handles large block numbers', () => {
    const txBlock = 10_000_000n;
    const currentBlock = 10_000_012n;
    expect(calculateConfirmations(txBlock, currentBlock)).toBe(13);
  });
});

describe('getConfirmationsFromState', () => {
  it('uses state.confirmations if available', () => {
    const state = createState('confirming', { blockNumber: 100n, confirmations: 5 });
    expect(getConfirmationsFromState(state, 105n)).toBe(5);
  });

  it('calculates from blockNumber if confirmations is null', () => {
    const state = createState('confirming', { blockNumber: 100n, confirmations: null });
    expect(getConfirmationsFromState(state, 105n)).toBe(6);
  });

  it('returns 0 if blockNumber is null', () => {
    const state = createState('submitted', { blockNumber: null });
    expect(getConfirmationsFromState(state, 100n)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Finality checks
// ---------------------------------------------------------------------------

describe('isSafeConfirmations', () => {
  it('returns true when confirmations >= safe threshold', () => {
    expect(isSafeConfirmations(1, 10)).toBe(true); // OP Mainnet safe = 1
    expect(isSafeConfirmations(5, 10)).toBe(true);
  });

  it('returns false when confirmations < safe threshold', () => {
    expect(isSafeConfirmations(0, 10)).toBe(false);
  });

  it('returns null for unknown chains (fail-closed)', () => {
    expect(isSafeConfirmations(1, 999)).toBeNull();
  });

  it('handles OP Sepolia', () => {
    expect(isSafeConfirmations(1, 11155420)).toBe(true);
    expect(isSafeConfirmations(0, 11155420)).toBe(false);
  });

  it('handles Hardhat local fork', () => {
    expect(isSafeConfirmations(1, 31337)).toBe(true);
  });
});

describe('isFinalizedConfirmations', () => {
  it('returns true when confirmations >= finalized threshold', () => {
    expect(isFinalizedConfirmations(12, 10)).toBe(true); // OP Mainnet finalized = 12
    expect(isFinalizedConfirmations(20, 10)).toBe(true);
  });

  it('returns false when confirmations < finalized threshold', () => {
    expect(isFinalizedConfirmations(11, 10)).toBe(false);
    expect(isFinalizedConfirmations(1, 10)).toBe(false);
  });

  it('returns null for unknown chains (fail-closed)', () => {
    expect(isFinalizedConfirmations(12, 999)).toBeNull();
  });
});

describe('getFinalityLevel', () => {
  it('returns "none" when confirmations < safe threshold', () => {
    expect(getFinalityLevel(0, 10)).toBe('none');
  });

  it('returns "safe" when confirmations >= safe but < finalized', () => {
    expect(getFinalityLevel(1, 10)).toBe('safe');
    expect(getFinalityLevel(11, 10)).toBe('safe');
  });

  it('returns "finalized" when confirmations >= finalized threshold', () => {
    expect(getFinalityLevel(12, 10)).toBe('finalized');
    expect(getFinalityLevel(20, 10)).toBe('finalized');
  });

  it('returns "none" for unknown chains (fail-closed)', () => {
    expect(getFinalityLevel(12, 999)).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// Finality guards
// ---------------------------------------------------------------------------

describe('canShowDurableSuccess', () => {
  it('requires ALL conditions: finalized + threshold + indexer + not reorged', () => {
    const state = createState('finalized', {
      blockNumber: 100n,
      confirmations: 12,
      error: null,
    });
    expect(canShowDurableSuccess(state, true)).toBe(true);
  });

  it('returns false if state is not finalized', () => {
    const state = createState('safe', { confirmations: 12 });
    expect(canShowDurableSuccess(state, true)).toBe(false);
  });

  it('returns false if confirmations < finalized threshold', () => {
    const state = createState('finalized', { confirmations: 11, chainId: 10 });
    expect(canShowDurableSuccess(state, true)).toBe(false);
  });

  it('returns false if indexer not acknowledged', () => {
    const state = createState('finalized', { confirmations: 12 });
    expect(canShowDurableSuccess(state, false)).toBe(false);
  });

  it('returns false if transaction is reorged', () => {
    const state = createState('finalized', { confirmations: 12, error: 'REORGED' });
    expect(canShowDurableSuccess(state, true)).toBe(false);
  });

  it('returns false for unknown chains', () => {
    const state = createState('finalized', { confirmations: 12, chainId: 999 });
    expect(canShowDurableSuccess(state, true)).toBe(false);
  });
});

describe('canShowProvisionalSuccess', () => {
  it('returns true for safe state with >= safe threshold', () => {
    const state = createState('safe', { confirmations: 1, error: null });
    expect(canShowProvisionalSuccess(state)).toBe(true);
  });

  it('returns true for indexing state with >= safe threshold', () => {
    const state = createState('indexing', { confirmations: 5, error: null });
    expect(canShowProvisionalSuccess(state)).toBe(true);
  });

  it('returns false if confirmations < safe threshold', () => {
    const state = createState('safe', { confirmations: 0, chainId: 10 });
    expect(canShowProvisionalSuccess(state)).toBe(false);
  });

  it('returns false if transaction is reorged', () => {
    const state = createState('safe', { confirmations: 1, error: 'REORGED' });
    expect(canShowProvisionalSuccess(state)).toBe(false);
  });

  it('returns false for non-safe/indexing states', () => {
    const state = createState('confirming', { confirmations: 1 });
    expect(canShowProvisionalSuccess(state)).toBe(false);
  });

  it('returns false for unknown chains', () => {
    const state = createState('safe', { confirmations: 1, chainId: 999 });
    expect(canShowProvisionalSuccess(state)).toBe(false);
  });
});

describe('shouldWithholdSuccess', () => {
  it('returns true for pre-inclusion states', () => {
    expect(shouldWithholdSuccess(createState('idle'))).toBe(true);
    expect(shouldWithholdSuccess(createState('preparing'))).toBe(true);
    expect(shouldWithholdSuccess(createState('signature-requested'))).toBe(true);
    expect(shouldWithholdSuccess(createState('submitted'))).toBe(true);
    expect(shouldWithholdSuccess(createState('confirming'))).toBe(true);
  });

  it('returns true for terminal failure states', () => {
    expect(shouldWithholdSuccess(createState('dropped'))).toBe(true);
    expect(shouldWithholdSuccess(createState('reverted'))).toBe(true);
    expect(shouldWithholdSuccess(createState('reorged'))).toBe(true);
  });

  it('returns false for success-eligible states', () => {
    expect(shouldWithholdSuccess(createState('safe'))).toBe(false);
    expect(shouldWithholdSuccess(createState('indexing'))).toBe(false);
    expect(shouldWithholdSuccess(createState('finalized'))).toBe(false);
  });

  it('returns false for replaced (user may want to track replacement)', () => {
    expect(shouldWithholdSuccess(createState('replaced'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Time estimates
// ---------------------------------------------------------------------------

describe('estimateTimeToSafe', () => {
  it('calculates time based on remaining blocks to safe threshold', () => {
    const result = estimateTimeToSafe(0, 10); // 0 confs, need 1, block time 2s
    expect(result).toBe(2000);
  });

  it('returns 0 if already safe', () => {
    expect(estimateTimeToSafe(1, 10)).toBe(0);
    expect(estimateTimeToSafe(5, 10)).toBe(0);
  });

  it('returns null for unknown chains', () => {
    expect(estimateTimeToSafe(0, 999)).toBeNull();
  });

  it('uses chain-specific block times', () => {
    // Hardhat: block time 100ms, safe threshold 1
    expect(estimateTimeToSafe(0, 31337)).toBe(100);
  });
});

describe('estimateTimeToFinalized', () => {
  it('calculates time based on remaining blocks to finalized threshold', () => {
    const result = estimateTimeToFinalized(1, 10); // 1 conf, need 12, 11 blocks * 2s
    expect(result).toBe(22000);
  });

  it('returns 0 if already finalized', () => {
    expect(estimateTimeToFinalized(12, 10)).toBe(0);
    expect(estimateTimeToFinalized(20, 10)).toBe(0);
  });

  it('returns null for unknown chains', () => {
    expect(estimateTimeToFinalized(1, 999)).toBeNull();
  });
});

describe('formatTimeEstimate', () => {
  it('formats seconds', () => {
    expect(formatTimeEstimate(1000)).toBe('~1s');
    expect(formatTimeEstimate(2500)).toBe('~2s');
    expect(formatTimeEstimate(30000)).toBe('~30s');
  });

  it('formats minutes', () => {
    expect(formatTimeEstimate(60000)).toBe('~1m');
    expect(formatTimeEstimate(120000)).toBe('~2m');
    expect(formatTimeEstimate(90000)).toBe('~1m'); // rounds down
  });

  it('formats hours', () => {
    expect(formatTimeEstimate(3600000)).toBe('~1h');
    expect(formatTimeEstimate(7200000)).toBe('~2h');
  });

  it('handles edge cases', () => {
    expect(formatTimeEstimate(0)).toBe('~0s');
    expect(formatTimeEstimate(500)).toBe('~0s'); // rounds down
  });
});

// ---------------------------------------------------------------------------
// Polling intervals
// ---------------------------------------------------------------------------

describe('getPollingInterval', () => {
  it('returns 2s for submitted state', () => {
    expect(getPollingInterval('submitted')).toBe(2000);
  });

  it('returns 3s for confirming state', () => {
    expect(getPollingInterval('confirming')).toBe(3000);
  });

  it('returns 5s for safe state', () => {
    expect(getPollingInterval('safe')).toBe(5000);
  });

  it('returns 5s for indexing state', () => {
    expect(getPollingInterval('indexing')).toBe(5000);
  });

  it('returns null for terminal states (stop polling)', () => {
    expect(getPollingInterval('idle')).toBeNull();
    expect(getPollingInterval('finalized')).toBeNull();
    expect(getPollingInterval('dropped')).toBeNull();
    expect(getPollingInterval('replaced')).toBeNull();
    expect(getPollingInterval('reverted')).toBeNull();
    expect(getPollingInterval('reorged')).toBeNull();
  });

  it('returns null for pre-submission states', () => {
    expect(getPollingInterval('preparing')).toBeNull();
    expect(getPollingInterval('signature-requested')).toBeNull();
  });
});

describe('shouldPoll', () => {
  it('returns true for active polling states', () => {
    expect(shouldPoll('submitted')).toBe(true);
    expect(shouldPoll('confirming')).toBe(true);
    expect(shouldPoll('safe')).toBe(true);
    expect(shouldPoll('indexing')).toBe(true);
  });

  it('returns false for terminal states', () => {
    expect(shouldPoll('idle')).toBe(false);
    expect(shouldPoll('finalized')).toBe(false);
    expect(shouldPoll('dropped')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Progress calculation
// ---------------------------------------------------------------------------

describe('calculateConfirmationProgress', () => {
  it('calculates percentage: (current / target) * 100', () => {
    expect(calculateConfirmationProgress(0, 12)).toBe(0);
    expect(calculateConfirmationProgress(6, 12)).toBe(50);
    expect(calculateConfirmationProgress(12, 12)).toBe(100);
  });

  it('clamps to 0-100 range', () => {
    expect(calculateConfirmationProgress(-1, 12)).toBe(0);
    expect(calculateConfirmationProgress(15, 12)).toBe(100);
  });

  it('handles target = 0 (returns 100)', () => {
    expect(calculateConfirmationProgress(5, 0)).toBe(100);
  });

  it('handles edge cases', () => {
    expect(calculateConfirmationProgress(1, 1)).toBe(100);
    expect(calculateConfirmationProgress(0, 1)).toBe(0);
  });
});

describe('getProgressTarget', () => {
  it('returns finalized threshold if not yet finalized', () => {
    expect(getProgressTarget(5, 10)).toBe(12); // OP Mainnet
  });

  it('returns safe threshold if already finalized', () => {
    expect(getProgressTarget(12, 10)).toBe(1);
  });

  it('returns null for unknown chains', () => {
    expect(getProgressTarget(5, 999)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('isConfirmationCountValid', () => {
  it('returns true for valid confirmation count in state', () => {
    const state = createState('confirming', { confirmations: 5 });
    expect(isConfirmationCountValid(state)).toBe(true);
  });

  it('returns false for confirming state with 0 confirmations', () => {
    const state = createState('confirming', { confirmations: 0 });
    expect(isConfirmationCountValid(state)).toBe(false);
  });

  it('returns false for safe state with 0 confirmations', () => {
    const state = createState('safe', { confirmations: 0 });
    expect(isConfirmationCountValid(state)).toBe(false);
  });

  it('returns true for submitted state with null confirmations', () => {
    const state = createState('submitted', { confirmations: null });
    expect(isConfirmationCountValid(state)).toBe(true);
  });

  it('returns true for idle state', () => {
    const state = createState('idle');
    expect(isConfirmationCountValid(state)).toBe(true);
  });
});

describe('isConfirmationTransitionValid', () => {
  it('allows forward transitions with increasing confirmations', () => {
    const prev = createState('confirming', { confirmations: 5 });
    const next = createState('confirming', { confirmations: 6 });
    expect(isConfirmationTransitionValid(prev, next)).toBe(true);
  });

  it('allows transition to safe', () => {
    const prev = createState('confirming', { confirmations: 0 });
    const next = createState('safe', { confirmations: 1 });
    expect(isConfirmationTransitionValid(prev, next)).toBe(true);
  });

  it('rejects backward confirmation count', () => {
    const prev = createState('confirming', { confirmations: 5 });
    const next = createState('confirming', { confirmations: 4 });
    expect(isConfirmationTransitionValid(prev, next)).toBe(false);
  });

  it('rejects transition to reorged with same confirmation count', () => {
    const prev = createState('safe', { confirmations: 5 });
    const next = createState('reorged', { confirmations: 5 });
    expect(isConfirmationTransitionValid(prev, next)).toBe(false);
  });

  it('allows terminal state transitions', () => {
    const prev = createState('confirming', { confirmations: 5 });
    const next = createState('dropped', { confirmations: null });
    expect(isConfirmationTransitionValid(prev, next)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Chain-specific thresholds
// ---------------------------------------------------------------------------

describe('CONFIRMATION_THRESHOLDS', () => {
  it('defines Optimism Mainnet thresholds', () => {
    const config = CONFIRMATION_THRESHOLDS[10];
    expect(config).toEqual({
      safe: 1,
      finalized: 12,
      blockTimeMs: 2000,
    });
  });

  it('defines OP Sepolia thresholds', () => {
    const config = CONFIRMATION_THRESHOLDS[11155420];
    expect(config).toEqual({
      safe: 1,
      finalized: 12,
      blockTimeMs: 2000,
    });
  });

  it('defines Hardhat local fork thresholds', () => {
    const config = CONFIRMATION_THRESHOLDS[31337];
    expect(config).toEqual({
      safe: 1,
      finalized: 1,
      blockTimeMs: 100,
    });
  });

  it('does not define unsupported chains', () => {
    expect(CONFIRMATION_THRESHOLDS[1]).toBeUndefined(); // Ethereum mainnet
    expect(CONFIRMATION_THRESHOLDS[999]).toBeUndefined();
  });
});
