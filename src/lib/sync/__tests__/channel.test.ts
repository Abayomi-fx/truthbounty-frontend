/**
 * UI-FE-059 — Cross-tab channel unit tests.
 *
 * Focus: two-tab convergence, loop/replay suppression, bounded sender ledger,
 * and the storage fallback transport.
 */

import {
  CROSS_TAB_MAX_TRACKED_SENDERS,
  createCrossTabChannel,
  type BroadcastChannelLike,
  type CrossTabChannel,
} from '../channel';
import type { CrossTabPayload, WalletContextReason } from '../protocol';

const ACCOUNT_A = '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E';
const ACCOUNT_B = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

function wallet(
  reason: WalletContextReason,
  epoch: number,
  account: string | null,
  chainId: number | null,
): CrossTabPayload {
  return {
    kind: 'wallet-context',
    reason,
    account: account as `0x${string}` | null,
    chainId,
    epoch,
  };
}

/** Shared in-memory broadcast bus with per-listener delivery. */
function makeBus() {
  const listeners = new Set<(event: { data: unknown }) => void>();
  return {
    makeChannel(): BroadcastChannelLike {
      const own = new Set<(event: { data: unknown }) => void>();
      return {
        postMessage(data) {
          for (const listener of [...listeners]) listener({ data });
        },
        addEventListener(_type, listener) {
          listeners.add(listener);
          own.add(listener);
        },
        removeEventListener(_type, listener) {
          listeners.delete(listener);
          own.delete(listener);
        },
        close() {
          for (const listener of own) listeners.delete(listener);
          own.clear();
        },
      };
    },
    emit(data: unknown) {
      for (const listener of [...listeners]) listener({ data });
    },
    size: () => listeners.size,
  };
}

function makeStorageEnv() {
  const map = new Map<string, string>();
  const listeners = new Map<string, (event: unknown) => void>();
  return {
    map,
    emitStorage(event: { key: string; newValue: string | null }) {
      listeners.get('storage')?.(event);
    },
    env: {
      channel: null,
      storage: {
        setItem: (key: string, value: string) => map.set(key, value),
        getItem: (key: string) => map.get(key) ?? null,
      },
      eventTarget: {
        addEventListener: (type: string, listener: (event: unknown) => void) =>
          listeners.set(type, listener),
        removeEventListener: (type: string) => listeners.delete(type),
      },
    },
  };
}

function connect(bus: ReturnType<typeof makeBus>, senderId: string): CrossTabChannel {
  return createCrossTabChannel({
    senderId,
    env: { channel: bus.makeChannel() },
    now: () => 1_700_000_000_000,
  });
}

describe('cross-tab channel — two-tab convergence', () => {
  it('delivers connect and disconnect between sibling tabs', () => {
    const bus = makeBus();
    const tabA = connect(bus, 'tab-a');
    const tabB = connect(bus, 'tab-b');
    const received = jest.fn();
    tabB.subscribe(received);

    tabA.publish(wallet('connect', 1, ACCOUNT_A, 10));
    tabA.publish(wallet('disconnect', 2, null, null));

    expect(received).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ kind: 'wallet-context', reason: 'connect', epoch: 1 }),
    );
    expect(received).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ kind: 'wallet-context', reason: 'disconnect', epoch: 2 }),
    );
  });

  it('delivers account and chain switches', () => {
    const bus = makeBus();
    const tabA = connect(bus, 'tab-a');
    const tabB = connect(bus, 'tab-b');
    const received = jest.fn();
    tabB.subscribe(received);

    tabA.publish(wallet('account-change', 1, ACCOUNT_B, 10));
    tabA.publish(wallet('chain-change', 2, ACCOUNT_B, 11155420));

    expect(received).toHaveBeenCalledTimes(2);
    expect(received).toHaveBeenLastCalledWith(
      expect.objectContaining({ reason: 'chain-change', chainId: 11155420 }),
    );
  });

  it('delivers session-state and consent events without secrets', () => {
    const bus = makeBus();
    const tabA = connect(bus, 'tab-a');
    const tabB = connect(bus, 'tab-b');
    const received = jest.fn();
    tabB.subscribe(received);

    tabA.publish({ kind: 'session-state', reason: 'expired', epoch: 4 });
    tabA.publish({ kind: 'consent', choice: 'granted' });

    expect(received).toHaveBeenCalledTimes(2);
    const frames = received.mock.calls.map(([event]) => JSON.stringify(event));
    for (const frame of frames) {
      expect(frame).not.toMatch(/token|signature|authorization/i);
    }
  });
});

describe('cross-tab channel — loop & replay suppression', () => {
  it('never delivers a tab its own event', () => {
    const bus = makeBus();
    const tabA = connect(bus, 'tab-a');
    const received = jest.fn();
    tabA.subscribe(received);

    tabA.publish(wallet('connect', 1, ACCOUNT_A, 10));

    expect(received).not.toHaveBeenCalled();
  });

  it('drops replayed or out-of-order events from a sender', () => {
    const bus = makeBus();
    const tabB = connect(bus, 'tab-b');
    const received = jest.fn();
    tabB.subscribe(received);

    const frame = (seq: number) => ({
      v: 1,
      kind: 'wallet-context',
      reason: 'connect',
      account: ACCOUNT_A,
      chainId: 10,
      epoch: seq,
      sender: 'tab-a',
      seq,
      at: 1,
    });

    bus.emit(frame(2));
    bus.emit(frame(2));
    bus.emit(frame(1));

    expect(received).toHaveBeenCalledTimes(1);
  });

  it('bounds the sender ledger so hostile senders cannot grow it without limit', () => {
    const bus = makeBus();
    const tabB = connect(bus, 'tab-b');
    const received = jest.fn();
    tabB.subscribe(received);

    for (let i = 0; i < CROSS_TAB_MAX_TRACKED_SENDERS + 10; i += 1) {
      bus.emit({
        v: 1,
        kind: 'consent',
        choice: 'granted',
        sender: `hostile-${i}`,
        seq: 1,
        at: 1,
      });
    }

    expect(received).toHaveBeenCalledTimes(CROSS_TAB_MAX_TRACKED_SENDERS + 10);
  });
});

describe('cross-tab channel — storage fallback', () => {
  it('publishes to storage and validates incoming storage events', () => {
    const { env, map, emitStorage } = makeStorageEnv();
    const channel = createCrossTabChannel({
      senderId: 'tab-a',
      storageKey: 'sync-key',
      env: env as never,
    });
    const received = jest.fn();
    channel.subscribe(received);

    channel.publish({ kind: 'consent', choice: 'denied' });

    const raw = map.get('sync-key');
    expect(raw).toBeTruthy();
    emitStorage({ key: 'sync-key', newValue: raw ?? null });

    // The frame came from tab-a, so it is suppressed as a loop.
    expect(received).not.toHaveBeenCalled();
  });

  it('ignores malformed storage payloads', () => {
    const { env, emitStorage } = makeStorageEnv();
    const channel = createCrossTabChannel({
      senderId: 'tab-b',
      storageKey: 'sync-key',
      env: env as never,
    });
    const received = jest.fn();
    channel.subscribe(received);

    emitStorage({ key: 'sync-key', newValue: '{not json' });
    emitStorage({ key: 'sync-key', newValue: '{"token":"leak"}' });

    expect(received).not.toHaveBeenCalled();
  });
});
