/**
 * V2-FE Reorg Detection Unit Tests
 *
 * Coverage:
 * - State checks (isReorged, isVulnerableToReorg, isReorgProof, canTransitionToReorged)
 * - Recovery state management (create, advance, step sequencing)
 * - Impact analysis (severity, affected states, recovery actions)
 * - Event validation (isValidReorgEvent structure checks)
 * - Plausibility assessment (depth-based: plausible/suspicious/anomalous)
 * - User notifications (context-aware messaging per detection method)
 * - Metrics tracking (recording, aggregation by method/depth)
 *
 * Security invariants:
 * - State checks never fabricate reorg status
 * - Recovery flow follows strict step sequencing
 * - Impact analysis based on canonical state only
 * - Plausibility flags deep reorgs (>10 confirmations) as anomalous
 * - Notifications provide actionable guidance
 */

import {
  isReorged,
  isVulnerableToReorg,
  isReorgProof,
  canTransitionToReorged,
  createReorgRecoveryState,
  advanceReorgRecovery,
  analyzeReorgImpact,
  isValidReorgEvent,
  assessReorgPlausibility,
  generateReorgNotification,
  createReorgMetrics,
  recordReorgMetric,
  type ReorgDetectionEvent,
  type ReorgDetectionMethod,
} from '@/lib/reorg-detection';

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

const createReorgEvent = (
  method: ReorgDetectionMethod,
  overrides: Partial<ReorgDetectionEvent> = {}
): ReorgDetectionEvent => {
  return {
    method,
    originalBlockNumber: 12345n,
    originalBlockHash: '0xabc123' as `0x${string}`,
    timestamp: Date.now(),
    ...overrides,
  };
};

// ---------------------------------------------------------------------------
// State checks
// ---------------------------------------------------------------------------

describe('isReorged', () => {
  it('returns true for reorged status', () => {
    const state = createState('reorged');
    expect(isReorged(state)).toBe(true);
  });

  it('returns false for non-reorged statuses', () => {
    expect(isReorged(createState('idle'))).toBe(false);
    expect(isReorged(createState('confirming'))).toBe(false);
    expect(isReorged(createState('safe'))).toBe(false);
    expect(isReorged(createState('finalized'))).toBe(false);
  });
});

describe('isVulnerableToReorg', () => {
  it('returns true for confirming/safe/indexing states', () => {
    expect(isVulnerableToReorg(createState('confirming'))).toBe(true);
    expect(isVulnerableToReorg(createState('safe'))).toBe(true);
    expect(isVulnerableToReorg(createState('indexing'))).toBe(true);
  });

  it('returns false for finalized state (reorg-proof)', () => {
    expect(isVulnerableToReorg(createState('finalized'))).toBe(false);
  });

  it('returns false for pre-inclusion states', () => {
    expect(isVulnerableToReorg(createState('idle'))).toBe(false);
    expect(isVulnerableToReorg(createState('submitted'))).toBe(false);
  });

  it('returns false for terminal failure states', () => {
    expect(isVulnerableToReorg(createState('dropped'))).toBe(false);
    expect(isVulnerableToReorg(createState('reverted'))).toBe(false);
    expect(isVulnerableToReorg(createState('reorged'))).toBe(false);
  });
});

describe('isReorgProof', () => {
  it('returns true for finalized state only', () => {
    expect(isReorgProof(createState('finalized'))).toBe(true);
  });

  it('returns false for all other states', () => {
    expect(isReorgProof(createState('confirming'))).toBe(false);
    expect(isReorgProof(createState('safe'))).toBe(false);
    expect(isReorgProof(createState('indexing'))).toBe(false);
  });
});

describe('canTransitionToReorged', () => {
  it('returns true for post-SUBMITTED states', () => {
    expect(canTransitionToReorged(createState('submitted'))).toBe(true);
    expect(canTransitionToReorged(createState('confirming'))).toBe(true);
    expect(canTransitionToReorged(createState('safe'))).toBe(true);
    expect(canTransitionToReorged(createState('indexing'))).toBe(true);
  });

  it('returns false for pre-SUBMITTED states', () => {
    expect(canTransitionToReorged(createState('idle'))).toBe(false);
    expect(canTransitionToReorged(createState('preparing'))).toBe(false);
    expect(canTransitionToReorged(createState('signature-requested'))).toBe(false);
  });

  it('returns false for terminal states', () => {
    expect(canTransitionToReorged(createState('finalized'))).toBe(false);
    expect(canTransitionToReorged(createState('dropped'))).toBe(false);
    expect(canTransitionToReorged(createState('reverted'))).toBe(false);
    expect(canTransitionToReorged(createState('reorged'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Recovery state management
// ---------------------------------------------------------------------------

describe('createReorgRecoveryState', () => {
  it('creates initial recovery state', () => {
    const state = createReorgRecoveryState();
    expect(state).toEqual({
      step: 'detected',
      invalidatedKeys: [],
      userNotified: false,
      acknowledged: false,
    });
  });
});

describe('advanceReorgRecovery', () => {
  it('advances from detected to caches-invalidated', () => {
    const initial = createReorgRecoveryState();
    const next = advanceReorgRecovery(initial, 'caches-invalidated', ['claims', 'verifications']);
    
    expect(next.step).toBe('caches-invalidated');
    expect(next.invalidatedKeys).toEqual(['claims', 'verifications']);
  });

  it('advances from caches-invalidated to user-notified', () => {
    const state = {
      step: 'caches-invalidated' as const,
      invalidatedKeys: ['claims'],
      userNotified: false,
      acknowledged: false,
    };
    const next = advanceReorgRecovery(state, 'user-notified', []);
    
    expect(next.step).toBe('user-notified');
    expect(next.userNotified).toBe(true);
  });

  it('advances from user-notified to acknowledged', () => {
    const state = {
      step: 'user-notified' as const,
      invalidatedKeys: ['claims'],
      userNotified: true,
      acknowledged: false,
    };
    const next = advanceReorgRecovery(state, 'acknowledged', []);
    
    expect(next.step).toBe('acknowledged');
    expect(next.acknowledged).toBe(true);
  });

  it('advances from acknowledged to retrying', () => {
    const state = {
      step: 'acknowledged' as const,
      invalidatedKeys: ['claims'],
      userNotified: true,
      acknowledged: true,
    };
    const next = advanceReorgRecovery(state, 'retrying', []);
    
    expect(next.step).toBe('retrying');
  });

  it('preserves invalidatedKeys across steps', () => {
    const initial = createReorgRecoveryState();
    const step1 = advanceReorgRecovery(initial, 'caches-invalidated', ['claims']);
    const step2 = advanceReorgRecovery(step1, 'user-notified', []);
    
    expect(step2.invalidatedKeys).toEqual(['claims']);
  });
});

// ---------------------------------------------------------------------------
// Impact analysis
// ---------------------------------------------------------------------------

describe('analyzeReorgImpact', () => {
  it('returns "low" severity for safe/indexing states', () => {
    const safeState = createState('safe', { confirmations: 5 });
    const result = analyzeReorgImpact(safeState);
    
    expect(result.severity).toBe('low');
    expect(result.affectedStates).toContain('safe');
  });

  it('returns "high" severity for finalized state (should not happen)', () => {
    const finalizedState = createState('finalized', { confirmations: 12 });
    const result = analyzeReorgImpact(finalizedState);
    
    expect(result.severity).toBe('high');
    expect(result.affectedStates).toContain('finalized');
    expect(result.recoveryActions).toContain('report-anomaly');
  });

  it('includes invalidate-caches recovery action', () => {
    const state = createState('safe');
    const result = analyzeReorgImpact(state);
    
    expect(result.recoveryActions).toContain('invalidate-caches');
  });

  it('includes notify-user recovery action', () => {
    const state = createState('safe');
    const result = analyzeReorgImpact(state);
    
    expect(result.recoveryActions).toContain('notify-user');
  });

  it('includes validate-all-receipts for finalized reorgs', () => {
    const state = createState('finalized');
    const result = analyzeReorgImpact(state);
    
    expect(result.recoveryActions).toContain('validate-all-receipts');
  });
});

// ---------------------------------------------------------------------------
// Event validation
// ---------------------------------------------------------------------------

describe('isValidReorgEvent', () => {
  it('returns true for valid event structure', () => {
    const event = createReorgEvent('websocket-rollback');
    expect(isValidReorgEvent(event)).toBe(true);
  });

  it('returns false for missing method', () => {
    const event = { originalBlockNumber: 123n, timestamp: Date.now() } as any;
    expect(isValidReorgEvent(event)).toBe(false);
  });

  it('returns false for missing originalBlockNumber', () => {
    const event = { method: 'websocket-rollback', timestamp: Date.now() } as any;
    expect(isValidReorgEvent(event)).toBe(false);
  });

  it('returns false for missing timestamp', () => {
    const event = { method: 'websocket-rollback', originalBlockNumber: 123n } as any;
    expect(isValidReorgEvent(event)).toBe(false);
  });

  it('accepts optional fields', () => {
    const event = createReorgEvent('rpc-receipt-missing', {
      currentBlockHash: '0xdef456' as `0x${string}`,
    });
    expect(isValidReorgEvent(event)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Plausibility assessment
// ---------------------------------------------------------------------------

describe('assessReorgPlausibility', () => {
  it('returns "plausible" for <=3 confirmations', () => {
    expect(assessReorgPlausibility(0, 10)).toBe('plausible');
    expect(assessReorgPlausibility(1, 10)).toBe('plausible');
    expect(assessReorgPlausibility(3, 10)).toBe('plausible');
  });

  it('returns "suspicious" for 4-10 confirmations', () => {
    expect(assessReorgPlausibility(4, 10)).toBe('suspicious');
    expect(assessReorgPlausibility(7, 10)).toBe('suspicious');
    expect(assessReorgPlausibility(10, 10)).toBe('suspicious');
  });

  it('returns "anomalous" for 11+ confirmations', () => {
    expect(assessReorgPlausibility(11, 10)).toBe('anomalous');
    expect(assessReorgPlausibility(20, 10)).toBe('anomalous');
  });

  it('returns "plausible" for unknown chains (fail-closed)', () => {
    expect(assessReorgPlausibility(5, 999)).toBe('plausible');
  });

  it('handles edge case of negative confirmations', () => {
    expect(assessReorgPlausibility(-1, 10)).toBe('plausible');
  });
});

// ---------------------------------------------------------------------------
// User notifications
// ---------------------------------------------------------------------------

describe('generateReorgNotification', () => {
  it('generates notification for websocket-rollback', () => {
    const notification = generateReorgNotification('websocket-rollback', 2, 10);
    
    expect(notification.title).toBe('Chain Reorganization Detected');
    expect(notification.description).toContain('blockchain reorganization');
    expect(notification.severity).toBe('warning');
    expect(notification.action).toBe('Retry transaction from the beginning');
  });

  it('generates notification for rpc-receipt-missing', () => {
    const notification = generateReorgNotification('rpc-receipt-missing', 5, 10);
    
    expect(notification.title).toBe('Transaction Receipt Missing');
    expect(notification.description).toContain('receipt no longer found');
    expect(notification.severity).toBe('warning');
  });

  it('generates notification for rpc-block-hash-mismatch', () => {
    const notification = generateReorgNotification('rpc-block-hash-mismatch', 3, 10);
    
    expect(notification.title).toBe('Block Hash Mismatch');
    expect(notification.description).toContain('block hash changed');
    expect(notification.severity).toBe('warning');
  });

  it('escalates severity for deep reorgs (suspicious)', () => {
    const notification = generateReorgNotification('websocket-rollback', 8, 10);
    
    expect(notification.severity).toBe('error');
    expect(notification.description).toContain('unusual');
  });

  it('escalates severity for very deep reorgs (anomalous)', () => {
    const notification = generateReorgNotification('websocket-rollback', 15, 10);
    
    expect(notification.severity).toBe('error');
    expect(notification.description).toContain('highly unusual');
  });

  it('includes plausibility context for shallow reorgs', () => {
    const notification = generateReorgNotification('websocket-rollback', 1, 10);
    
    expect(notification.description).toContain('reorganization');
  });
});

// ---------------------------------------------------------------------------
// Metrics tracking
// ---------------------------------------------------------------------------

describe('createReorgMetrics', () => {
  it('creates initial metrics state', () => {
    const metrics = createReorgMetrics();
    
    expect(metrics).toEqual({
      totalReorgs: 0,
      byMethod: {
        'websocket-rollback': 0,
        'rpc-receipt-missing': 0,
        'rpc-block-hash-mismatch': 0,
      },
      byDepth: {
        shallow: 0,
        medium: 0,
        deep: 0,
      },
      lastReorgTimestamp: null,
    });
  });
});

describe('recordReorgMetric', () => {
  it('increments total reorgs', () => {
    const metrics = createReorgMetrics();
    const updated = recordReorgMetric(metrics, 'websocket-rollback', 2);
    
    expect(updated.totalReorgs).toBe(1);
  });

  it('increments method-specific counter', () => {
    const metrics = createReorgMetrics();
    const updated = recordReorgMetric(metrics, 'rpc-receipt-missing', 3);
    
    expect(updated.byMethod['rpc-receipt-missing']).toBe(1);
    expect(updated.byMethod['websocket-rollback']).toBe(0);
  });

  it('categorizes shallow reorgs (<=3 confirmations)', () => {
    const metrics = createReorgMetrics();
    const updated = recordReorgMetric(metrics, 'websocket-rollback', 2);
    
    expect(updated.byDepth.shallow).toBe(1);
  });

  it('categorizes medium reorgs (4-10 confirmations)', () => {
    const metrics = createReorgMetrics();
    const updated = recordReorgMetric(metrics, 'websocket-rollback', 7);
    
    expect(updated.byDepth.medium).toBe(1);
  });

  it('categorizes deep reorgs (11+ confirmations)', () => {
    const metrics = createReorgMetrics();
    const updated = recordReorgMetric(metrics, 'websocket-rollback', 15);
    
    expect(updated.byDepth.deep).toBe(1);
  });

  it('updates lastReorgTimestamp', () => {
    const metrics = createReorgMetrics();
    const beforeTimestamp = Date.now();
    const updated = recordReorgMetric(metrics, 'websocket-rollback', 2);
    
    expect(updated.lastReorgTimestamp).toBeGreaterThanOrEqual(beforeTimestamp);
  });

  it('accumulates multiple reorgs', () => {
    const metrics = createReorgMetrics();
    const step1 = recordReorgMetric(metrics, 'websocket-rollback', 2);
    const step2 = recordReorgMetric(step1, 'rpc-receipt-missing', 5);
    const step3 = recordReorgMetric(step2, 'websocket-rollback', 12);
    
    expect(step3.totalReorgs).toBe(3);
    expect(step3.byMethod['websocket-rollback']).toBe(2);
    expect(step3.byMethod['rpc-receipt-missing']).toBe(1);
    expect(step3.byDepth.shallow).toBe(1);
    expect(step3.byDepth.medium).toBe(1);
    expect(step3.byDepth.deep).toBe(1);
  });
});
