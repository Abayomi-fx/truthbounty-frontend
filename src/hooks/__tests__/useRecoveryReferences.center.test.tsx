import { act, renderHook } from '@testing-library/react';
import { useRecoveryReferences } from '../useRecoveryReferences';
import { readRecoveryReferences } from '@/lib/transaction-machine/recovery-references';
import {
  createTxContext,
  persistTxState,
} from '@/lib/transaction-machine/transaction-persistence';
import { trackPendingTransaction } from '@/lib/pending-transactions';
import {
  transactionFixture,
  HASH,
} from '@/components/features/rewards-center/stories/fixtures';

beforeEach(() => {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
    },
  });
});

function save(status: Parameters<typeof transactionFixture>[0] = 'submitted') {
  const record = transactionFixture(status);
  persistTxState({
    ...createTxContext(record.id, record.label),
    state: record.state,
  });
  return record;
}

it('survives unmount/reload/reconnect without promoting saved finality or removing recovery keys', () => {
  const record = save('finalized');
  const first = renderHook(() => useRecoveryReferences());
  expect(first.result.current.records[0].source).toBe('local-reference');
  first.unmount();
  const second = renderHook(() => useRecoveryReferences());
  expect(second.result.current.records[0].state.txHash).toBe(HASH);
  act(() => {
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('focus'));
  });
  expect(second.result.current.records[0].id).toBe(record.id);
  expect(localStorage.getItem('tb-tx-v2:' + record.id)).not.toBeNull();
});

it('observes same-tab persistence and replacement, then cross-tab storage updates', () => {
  const { result } = renderHook(() => useRecoveryReferences());
  act(() => {
    save('replaced');
  });
  expect(result.current.records[0].state.replacedBy).toBeTruthy();
  act(() => {
    save('reorged');
    window.dispatchEvent(new Event('storage'));
  });
  expect(result.current.records).toHaveLength(1);
  expect(result.current.records[0].state.status).toBe('reorged');
  expect(
    result.current.records.every(
      (record) => record.source === 'local-reference',
    ),
  ).toBe(true);
});

it('deduplicates stores and retains the richer replacement record', () => {
  save('replaced');
  trackPendingTransaction({
    id: 'legacy',
    kind: 'rewards',
    title: 'Withdraw',
    description: '',
    txHash: HASH,
    chainId: 11155420,
    machineState: 'submitted',
  });
  const records = readRecoveryReferences();
  expect(records).toHaveLength(1);
  expect(records[0].state.replacedBy).not.toBeNull();
});

it.each([
  { chainId: 1 },
  { txHash: '0x123' },
  { replacedBy: 'javascript:alert(1)' },
])(
  'rejects incompatible/corrupt saved references %p without deleting them',
  (mutation) => {
    const record = save();
    const key = 'tb-tx-v2:' + record.id;
    const parsed = JSON.parse(localStorage.getItem(key)!);
    parsed.state = { ...parsed.state, ...mutation };
    localStorage.setItem(key, JSON.stringify(parsed));
    expect(readRecoveryReferences()).toEqual([]);
    expect(localStorage.getItem(key)).not.toBeNull();
  },
);

it('does not infer receipt state from a lightweight registry finality flag', () => {
  trackPendingTransaction({
    id: 'legacy',
    kind: 'rewards',
    title: 'Saved withdrawal',
    description: '',
    txHash: HASH,
    chainId: 10,
    machineState: 'finalized',
  });
  const [record] = readRecoveryReferences();
  expect(record.state.status).toBe('submitted');
  expect(record.source).toBe('local-reference');
});

it('survives corrupt JSON and denied storage without fabricating a record', () => {
  localStorage.setItem('tb-tx-v2:corrupt', '{');
  expect(readRecoveryReferences()).toEqual([]);
  Object.defineProperty(window.localStorage, 'length', {
    configurable: true,
    get() {
      throw new Error('Storage denied');
    },
  });
  expect(readRecoveryReferences()).toEqual([]);
});

it('preserves a signature request without inventing a hash or submitting on recovery', () => {
  save('signature-requested');
  const { result } = renderHook(() => useRecoveryReferences());
  expect(result.current.records).toHaveLength(1);
  expect(result.current.records[0].state.txHash).toBeNull();
  expect(result.current.records[0].source).toBe('local-reference');
});

it('exposes denied storage as unavailable, rather than an authoritative empty history', () => {
  Object.defineProperty(window.localStorage, 'length', {
    configurable: true,
    get() {
      throw new Error('Denied');
    },
  });
  const { result } = renderHook(() => useRecoveryReferences());
  expect(result.current.storageUnavailable).toBe(true);
});
