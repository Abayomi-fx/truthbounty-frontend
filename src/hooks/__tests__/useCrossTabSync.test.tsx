/**
 * UI-FE-059 — useCrossTabSync unit tests.
 *
 * Exercises two-tab connect/disconnect, account and chain switch, race
 * convergence, suspended-tab resume, session-expiry and consent relaying, and
 * the stale-tab mutation guarantee.
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { useCrossTabSync } from '../useCrossTabSync';
import {
  createCrossTabChannel,
  type BroadcastChannelLike,
  type CrossTabChannel,
} from '@/lib/sync/channel';
import {
  WALLET_CONTEXT_STORAGE_KEY,
  writeWalletContextSnapshot,
  normalizeContextIdentity,
  buildWalletContextSnapshot,
} from '@/lib/sync/wallet-context';

const ACCOUNT_A = '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E';
const ACCOUNT_B = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const ACCOUNT_C = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

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
  };
}

function channelFor(bus: ReturnType<typeof makeBus>, senderId: string): CrossTabChannel {
  return createCrossTabChannel({
    senderId,
    env: { channel: bus.makeChannel() },
    now: () => 1_700_000_000_000,
  });
}

interface TabOverrides {
  accountOverride?: string | null;
  chainIdOverride?: number | null;
  onSessionState?: jest.Mock;
  onConsent?: jest.Mock;
  onPendingTransaction?: jest.Mock;
}

function renderTab(
  channel: CrossTabChannel,
  senderId: string,
  overrides: TabOverrides = {},
) {
  return renderHook(
    (props: TabOverrides) =>
      useCrossTabSync({ channel, senderId, ...props }),
    { initialProps: overrides },
  );
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  });
});

describe('useCrossTabSync — two-tab connect / disconnect', () => {
  it('propagates a connect and then a disconnect to the sibling tab', async () => {
    const bus = makeBus();
    const tabA = renderTab(channelFor(bus, 'tab-a'), 'tab-a', {
      accountOverride: null,
      chainIdOverride: null,
    });
    const tabB = renderTab(channelFor(bus, 'tab-b'), 'tab-b', {
      accountOverride: null,
      chainIdOverride: null,
    });

    await waitFor(() => expect(tabB.result.current.context.epoch).toBe(0));

    act(() => {
      tabA.rerender({ accountOverride: ACCOUNT_A, chainIdOverride: 10 });
    });

    await waitFor(() =>
      expect(tabB.result.current.context.account).toBe(ACCOUNT_A),
    );
    expect(tabB.result.current.requiresRecovery).toBe(false);

    act(() => {
      tabA.rerender({ accountOverride: null, chainIdOverride: null });
    });

    await waitFor(() => expect(tabB.result.current.requiresRecovery).toBe(true));
    expect(tabB.result.current.canMutate).toBe(false);
    expect(tabB.result.current.recoveryMessage).toMatch(/disconnected/i);
  });
});

describe('useCrossTabSync — account & chain switch revocation', () => {
  it('does not let a stale tab mutate after a sibling account switch', async () => {
    const bus = makeBus();
    const tabA = renderTab(channelFor(bus, 'tab-a'), 'tab-a', {
      accountOverride: ACCOUNT_A,
      chainIdOverride: 10,
    });
    const tabB = renderTab(channelFor(bus, 'tab-b'), 'tab-b', {
      accountOverride: ACCOUNT_A,
      chainIdOverride: 10,
    });

    await waitFor(() => expect(tabB.result.current.canMutate).toBe(true));
    const guard = tabB.result.current.guard;
    const capturedEpoch = guard.capture();

    act(() => {
      tabA.rerender({ accountOverride: ACCOUNT_B, chainIdOverride: 10 });
    });

    await waitFor(() => expect(tabB.result.current.requiresRecovery).toBe(true));
    expect(tabB.result.current.canMutate).toBe(false);
    expect(tabB.result.current.context.account).toBe(ACCOUNT_B);
    expect(() => guard.assertCurrent(capturedEpoch)).toThrow(/changed in another tab/i);
    expect(tabB.result.current.recoveryMessage).toMatch(/account changed/i);
  });

  it('revokes and blocks mutation on a sibling chain switch', async () => {
    const bus = makeBus();
    const tabA = renderTab(channelFor(bus, 'tab-a'), 'tab-a', {
      accountOverride: ACCOUNT_A,
      chainIdOverride: 10,
    });
    const tabB = renderTab(channelFor(bus, 'tab-b'), 'tab-b', {
      accountOverride: ACCOUNT_A,
      chainIdOverride: 10,
    });

    await waitFor(() => expect(tabB.result.current.canMutate).toBe(true));

    act(() => {
      tabA.rerender({ accountOverride: ACCOUNT_A, chainIdOverride: 11155420 });
    });

    await waitFor(() => expect(tabB.result.current.requiresRecovery).toBe(true));
    expect(tabB.result.current.canMutate).toBe(false);
    expect(tabB.result.current.recoveryMessage).toMatch(/network changed/i);
  });

  it('clears recovery after the user acknowledges', async () => {
    const bus = makeBus();
    const tabA = renderTab(channelFor(bus, 'tab-a'), 'tab-a', {
      accountOverride: ACCOUNT_A,
      chainIdOverride: 10,
    });
    const tabB = renderTab(channelFor(bus, 'tab-b'), 'tab-b', {
      accountOverride: ACCOUNT_A,
      chainIdOverride: 10,
    });

    await waitFor(() => expect(tabB.result.current.canMutate).toBe(true));

    act(() => {
      tabA.rerender({ accountOverride: ACCOUNT_B, chainIdOverride: 10 });
    });
    await waitFor(() => expect(tabB.result.current.requiresRecovery).toBe(true));

    act(() => {
      tabB.result.current.acknowledge();
    });
    expect(tabB.result.current.requiresRecovery).toBe(false);
  });
});

describe('useCrossTabSync — race convergence', () => {
  it('converges deterministically when two tabs switch account at once', async () => {
    const bus = makeBus();
    const tabA = renderTab(channelFor(bus, 'tab-a'), 'tab-a', {
      accountOverride: ACCOUNT_A,
      chainIdOverride: 10,
    });
    const tabB = renderTab(channelFor(bus, 'tab-b'), 'tab-b', {
      accountOverride: ACCOUNT_A,
      chainIdOverride: 10,
    });

    await waitFor(() => expect(tabA.result.current.canMutate).toBe(true));
    await waitFor(() => expect(tabB.result.current.canMutate).toBe(true));

    act(() => {
      tabA.rerender({ accountOverride: ACCOUNT_B, chainIdOverride: 10 });
      tabB.rerender({ accountOverride: ACCOUNT_C, chainIdOverride: 10 });
    });

    await waitFor(() => {
      expect(tabA.result.current.context.account).toBe(
        tabB.result.current.context.account,
      );
    });
    expect(tabA.result.current.context.epoch).toBe(tabB.result.current.context.epoch);
  });
});

describe('useCrossTabSync — session expiry, consent & pending transactions', () => {
  it('fails a tab closed when a sibling reports a terminal session state', async () => {
    const bus = makeBus();
    const tabA = renderTab(channelFor(bus, 'tab-a'), 'tab-a', {
      accountOverride: ACCOUNT_A,
      chainIdOverride: 10,
    });
    const onSessionState = jest.fn();
    const tabB = renderTab(channelFor(bus, 'tab-b'), 'tab-b', {
      accountOverride: ACCOUNT_A,
      chainIdOverride: 10,
      onSessionState,
    });

    await waitFor(() => expect(tabB.result.current.canMutate).toBe(true));

    act(() => {
      tabA.result.current.publishSessionState('expired');
    });

    await waitFor(() => expect(tabB.result.current.requiresRecovery).toBe(true));
    expect(tabB.result.current.canMutate).toBe(false);
    expect(onSessionState).toHaveBeenCalledWith('expired');
    expect(tabB.result.current.recoveryMessage).toMatch(/session ended/i);
  });

  it('relays consent changes without gating mutation', async () => {
    const bus = makeBus();
    const tabA = renderTab(channelFor(bus, 'tab-a'), 'tab-a', {
      accountOverride: ACCOUNT_A,
      chainIdOverride: 10,
    });
    const onConsent = jest.fn();
    const tabB = renderTab(channelFor(bus, 'tab-b'), 'tab-b', {
      accountOverride: ACCOUNT_A,
      chainIdOverride: 10,
      onConsent,
    });

    await waitFor(() => expect(tabB.result.current.canMutate).toBe(true));

    act(() => {
      tabA.result.current.publishConsent('denied');
    });

    await waitFor(() => expect(onConsent).toHaveBeenCalledWith('denied'));
    expect(tabB.result.current.requiresRecovery).toBe(false);
  });

  it('relays pending-transaction registration without leaking a hash', async () => {
    const bus = makeBus();
    const tabA = renderTab(channelFor(bus, 'tab-a'), 'tab-a', {
      accountOverride: ACCOUNT_A,
      chainIdOverride: 10,
    });
    const onPendingTransaction = jest.fn();
    const tabB = renderTab(channelFor(bus, 'tab-b'), 'tab-b', {
      accountOverride: ACCOUNT_A,
      chainIdOverride: 10,
      onPendingTransaction,
    });

    await waitFor(() => expect(tabB.result.current.canMutate).toBe(true));

    act(() => {
      tabA.result.current.publishPendingTransaction('registered', 'tx-1', 10);
    });

    await waitFor(() =>
      expect(onPendingTransaction).toHaveBeenCalledWith('registered', 'tx-1', 10),
    );
    expect(JSON.stringify(tabB.result.current.lastRemoteEvent)).not.toMatch(
      /token|signature/i,
    );
  });
});

describe('useCrossTabSync — suspended-tab resume', () => {
  it('reconciles from the shared snapshot when a suspended tab wakes', async () => {
    const bus = makeBus();
    const tabB = renderTab(channelFor(bus, 'tab-b'), 'tab-b', {
      accountOverride: ACCOUNT_A,
      chainIdOverride: 10,
    });

    await waitFor(() => expect(tabB.result.current.context.epoch).toBe(0));

    // A sibling revoked the context while this tab was suspended.
    act(() => {
      writeWalletContextSnapshot(
        buildWalletContextSnapshot(
          normalizeContextIdentity(null, null),
          5,
          'disconnect',
          1_700_000_000_500,
        ),
      );
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(tabB.result.current.context.epoch).toBe(5));
    expect(tabB.result.current.requiresRecovery).toBe(true);
    expect(tabB.result.current.canMutate).toBe(false);
  });

  it('does not regress when the snapshot is not newer than local', async () => {
    const bus = makeBus();
    const tabB = renderTab(channelFor(bus, 'tab-b'), 'tab-b', {
      accountOverride: ACCOUNT_A,
      chainIdOverride: 10,
    });

    await waitFor(() => expect(tabB.result.current.context.epoch).toBe(0));

    act(() => {
      localStorage.setItem(
        WALLET_CONTEXT_STORAGE_KEY,
        JSON.stringify({
          account: ACCOUNT_B,
          chainId: 10,
          epoch: 0,
          reason: 'account-change',
          updatedAt: 1,
        }),
      );
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(tabB.result.current.context.account).toBe(ACCOUNT_A);
    expect(tabB.result.current.requiresRecovery).toBe(false);
  });
});
