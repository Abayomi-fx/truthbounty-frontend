import { beforeEach, describe, expect, it } from '@jest/globals';

/**
 * UI-FE-086 — Allowlist enforcement tests.
 *
 * Proves that optimistic UI is opt-in by operation, that only reversible
 * presentation fields can be changed, and that final/economic outcomes are
 * rejected before any cache mutation can occur.
 */

import {
  OPTIMISTIC_UPDATE_ALLOWLIST,
  getOptimisticOperation,
  isAllowedOptimisticOperationId,
  isProhibitedOptimisticPath,
  listOptimisticOperations,
  validateOptimisticPatch,
} from '@/lib/optimistic-updates/allowlist';
import { OptimisticUpdateError } from '@/lib/optimistic-updates/types';
import type { Claim } from '@/app/types/claim';

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

function expectOptimisticError(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error('expected an OptimisticUpdateError');
  } catch (error) {
    expect(error).toBeInstanceOf(OptimisticUpdateError);
    expect((error as OptimisticUpdateError).code).toBe(code);
  }
}

describe('optimistic update allowlist', () => {
  it('contains exactly the reviewed operation and is frozen', () => {
    expect(listOptimisticOperations().map((operation) => operation.id)).toEqual([
      'claim.status.under_review',
    ]);
    expect(Object.isFrozen(OPTIMISTIC_UPDATE_ALLOWLIST)).toBe(true);
    expect(isAllowedOptimisticOperationId('claim.status.under_review')).toBe(true);
  });

  it('rejects unknown operations', () => {
    expect(isAllowedOptimisticOperationId('claim.status.verified')).toBe(false);
    expectOptimisticError(
      () => getOptimisticOperation('claim.status.verified'),
      'UNKNOWN_OPERATION',
    );
  });

  it('accepts only the allowlisted non-final presentation change', () => {
    const result = validateOptimisticPatch(
      'claim.status.under_review',
      claim(),
      { status: 'UNDER_REVIEW' },
    );

    expect(result.changedFields).toEqual(['status']);
    expect(result.optimistic.status).toBe('UNDER_REVIEW');
    expect(result.optimistic.title).toBe('A claim');
  });

  it('rejects final or economic claim statuses', () => {
    for (const status of ['VERIFIED', 'REJECTED', 'DISPUTED'] as const) {
      expectOptimisticError(
        () =>
          validateOptimisticPatch('claim.status.under_review', claim(), {
            status,
          }),
        'PROHIBITED_OUTCOME',
      );
    }
  });

  it('rejects an overlay that starts from an already-final claim', () => {
    for (const status of ['VERIFIED', 'REJECTED', 'DISPUTED'] as const) {
      expectOptimisticError(
        () =>
          validateOptimisticPatch(
            'claim.status.under_review',
            claim({ status }),
            { status: 'UNDER_REVIEW' },
          ),
        'PROHIBITED_OUTCOME',
      );
    }
  });

  it('rejects fields outside the operation allowlist', () => {
    const patches: Record<string, unknown>[] = [
      { rewardAmount: 999 },
      { permissions: ['ADMIN'] },
      { disputeOutcome: 'UPHELD' },
      { finality: 'finalized' },
      { settlement: 'complete' },
      { title: 'Changed optimistically' },
    ];

    for (const patch of patches) {
      expectOptimisticError(
        () =>
          validateOptimisticPatch('claim.status.under_review', claim(), patch),
        'UNSAFE_FIELD',
      );
    }
  });

  it('recognises prohibited semantic paths', () => {
    for (const path of [
      'finality',
      'finalized',
      'settlement',
      'rewardAmount',
      'claimable',
      'permissions',
      'role',
      'authoritative',
      'outcome',
      'verdict',
      'verified',
      'rejected',
      'disputeOutcome',
      'receipt',
      'confirmations',
    ]) {
      expect(isProhibitedOptimisticPath(path)).toBe(true);
    }

    expect(isProhibitedOptimisticPath('status')).toBe(false);
    expect(isProhibitedOptimisticPath('pending')).toBe(false);
  });

  it('fails closed when no snapshot exists', () => {
    expectOptimisticError(
      () =>
        validateOptimisticPatch(
          'claim.status.under_review',
          null as unknown as Claim,
          { status: 'UNDER_REVIEW' },
        ),
      'MISSING_SNAPSHOT',
    );
  });

  it('rejects empty and no-op patches', () => {
    expectOptimisticError(
      () => validateOptimisticPatch('claim.status.under_review', claim(), {}),
      'INVALID_PATCH',
    );
    expectOptimisticError(
      () =>
        validateOptimisticPatch(
          'claim.status.under_review',
          claim({ status: 'UNDER_REVIEW' }),
          { status: 'UNDER_REVIEW' },
        ),
      'INVALID_PATCH',
    );
  });
});
