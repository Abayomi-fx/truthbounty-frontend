import { beforeEach, describe, expect, it } from '@jest/globals';

/**
 * UI-FE-086 — Optimistic lifecycle tests.
 *
 * Covers exact rollback, commit/reconcile semantics, projection contradictions,
 * and every transaction terminal state.
 */

import {
  beginOptimisticUpdate,
  buildOptimisticUpdateId,
  commitOptimisticUpdate,
  isOptimisticFailureStatus,
  reconcileOptimisticUpdate,
  resolveOptimisticTransactionDecision,
  rollbackOptimisticUpdate,
} from '@/lib/optimistic-updates/optimistic-update';
import { OptimisticUpdateError } from '@/lib/optimistic-updates/types';
import type { Claim } from '@/app/types/claim';

const QUERY_KEY = ['claims', 'claim-1'] as const;

function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: 'claim-1',
    title: 'A claim',
    description: 'Description',
    claimantAddress: '0x0000000000000000000000000000000000000001',
    status: 'OPEN',
    bountyAmount: 100,
    totalStaked: 10,
    evidence: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function begin(current = claim()) {
  return beginOptimisticUpdate<Claim>({
    id: 'claim.status.under_review:["claims","claim-1"]',
    operationId: 'claim.status.under_review',
    queryKey: QUERY_KEY,
    current,
    patch: { status: 'UNDER_REVIEW' },
    now: 1_000,
  });
}

describe('optimistic update lifecycle', () => {
  it('captures the exact previous object and a separate optimistic object', () => {
    const previous = claim();
    const record = begin(previous);

    expect(record.previous).toBe(previous);
    expect(record.optimistic).not.toBe(previous);
    expect(record.optimistic.status).toBe('UNDER_REVIEW');
    expect(record.previous.status).toBe('OPEN');
    expect(record.changedFields).toEqual(['status']);
    expect(record.status).toBe('pending');
    expect(record.createdAt).toBe(1_000);
  });

  it('rolls back to the exact prior object on canonical failure', () => {
    const previous = claim();
    const record = begin(previous);
    const rolled = rollbackOptimisticUpdate(record, 'reverted');

    expect(rolled.data).toBe(previous);
    expect(rolled.record.status).toBe('rolled-back');
    expect(rolled.record.rollbackReason).toBe('reverted');
    // The original record is untouched (pure transition).
    expect(record.status).toBe('pending');
  });

  it('refuses to roll back or commit a non-pending record', () => {
    const rolled = rollbackOptimisticUpdate(begin(), 'dropped');
    expect(() => rollbackOptimisticUpdate(rolled.record, 'reverted')).toThrow(
      OptimisticUpdateError,
    );
    expect(() => commitOptimisticUpdate(rolled.record)).toThrow(
      OptimisticUpdateError,
    );
  });

  it('commits only after canonical reconciliation', () => {
    const record = begin();
    const reconciled = reconcileOptimisticUpdate(record, claim({ status: 'UNDER_REVIEW' }));

    expect(reconciled.action).toBe('commit');
    expect(reconciled.record.status).toBe('committed');
    expect(reconciled.data.status).toBe('UNDER_REVIEW');
  });

  it('keeps waiting while canonical still shows the prior value', () => {
    const reconciled = reconcileOptimisticUpdate(begin(), claim({ status: 'OPEN' }));

    expect(reconciled.action).toBe('keep');
    expect(reconciled.record.status).toBe('pending');
  });

  it('rolls back on a projection contradiction', () => {
    const previous = claim();
    const reconciled = reconcileOptimisticUpdate(
      begin(previous),
      claim({ status: 'VERIFIED' }),
    );

    expect(reconciled.action).toBe('rollback');
    if (reconciled.action === 'rollback') {
      expect(reconciled.reason).toBe('projection-contradiction');
    }
    expect(reconciled.data).toBe(previous);
  });

  it('fails closed when the canonical projection is missing', () => {
    const previous = claim();
    const record = begin(previous);

    for (const canonical of [null, undefined]) {
      const reconciled = reconcileOptimisticUpdate(record, canonical);
      expect(reconciled.action).toBe('rollback');
      expect(reconciled.data).toBe(previous);
      if (reconciled.action === 'rollback') {
        expect(reconciled.reason).toBe('projection-contradiction');
      }
    }
  });

  it.each([
    ['rejected', 'rejected'],
    ['reverted', 'reverted'],
    ['replaced', 'replaced'],
    ['dropped', 'dropped'],
    ['reorged', 'reorged'],
  ] as const)('rolls back on terminal failure "%s"', (status, reason) => {
    expect(resolveOptimisticTransactionDecision(status)).toEqual({
      action: 'rollback',
      reason,
    });
    expect(isOptimisticFailureStatus(status)).toBe(true);
  });

  it('clears the overlay on finalized and does nothing for non-terminal states', () => {
    expect(resolveOptimisticTransactionDecision('finalized')).toEqual({
      action: 'commit',
      reason: null,
    });

    for (const status of [
      'idle',
      'preparing',
      'signature-requested',
      'submitted',
      'confirming',
      'safe',
      'indexing',
    ] as const) {
      expect(resolveOptimisticTransactionDecision(status)).toEqual({
        action: 'none',
        reason: null,
      });
    }
  });

  it('builds stable ids and rejects unusable query keys', () => {
    expect(buildOptimisticUpdateId('claim.status.under_review', QUERY_KEY)).toBe(
      'claim.status.under_review:["claims","claim-1"]',
    );
    expect(() =>
      buildOptimisticUpdateId('claim.status.under_review', []),
    ).toThrow(OptimisticUpdateError);
  });
});
