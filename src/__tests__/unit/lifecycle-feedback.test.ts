/**
 * V2-FE-051 — lifecycle feedback helpers
 */
import {
  getTransactionLifecycleMessage,
  getTransactionLifecycleTone,
  needsLifecycleRecovery,
} from '@/lib/transaction-machine/lifecycle-feedback';

describe('lifecycle-feedback', () => {
  it('covers prepare/signature/submitted/confirming/finalized paths', () => {
    expect(getTransactionLifecycleMessage('preparing')).toMatch(/Preparing/i);
    expect(getTransactionLifecycleMessage('signature-requested')).toMatch(/signature/i);
    expect(getTransactionLifecycleMessage('submitted')).toMatch(/not final/i);
    expect(getTransactionLifecycleMessage('confirming')).toMatch(/receipt/i);
    expect(getTransactionLifecycleMessage('finalized')).toMatch(/finalized/i);
  });

  it('covers replaced/reverted/dropped/reorged recovery states', () => {
    expect(needsLifecycleRecovery('replaced')).toBe(true);
    expect(needsLifecycleRecovery('reverted')).toBe(true);
    expect(needsLifecycleRecovery('dropped')).toBe(true);
    expect(needsLifecycleRecovery('reorged')).toBe(true);
    expect(needsLifecycleRecovery('finalized')).toBe(false);
    expect(getTransactionLifecycleTone('reorged')).toBe('danger');
    expect(getTransactionLifecycleMessage('reorged')).toMatch(/orphan/i);
  });
});
