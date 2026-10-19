/**
 * UI-FE-059 — CrossTabSyncProvider recovery banner tests.
 *
 * The recovery notice must be explicit, announce assertively, and clear only
 * after the user acknowledges it.
 */

import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CrossTabSyncProvider } from '../CrossTabSyncProvider';
import {
  createCrossTabChannel,
  type BroadcastChannelLike,
  type CrossTabChannel,
} from '@/lib/sync/channel';

const ACCOUNT_A = '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E';
const ACCOUNT_B = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

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
  };
}

function channelFor(bus: ReturnType<typeof makeBus>, senderId: string): CrossTabChannel {
  return createCrossTabChannel({
    senderId,
    env: { channel: bus.makeChannel() },
    now: () => 1_700_000_000_000,
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe('CrossTabSyncProvider', () => {
  it('renders no banner before a sibling revokes the context', () => {
    const bus = makeBus();
    render(
      <CrossTabSyncProvider
        options={{
          channel: channelFor(bus, 'tab-b'),
          senderId: 'tab-b',
          accountOverride: ACCOUNT_A,
          chainIdOverride: 10,
        }}
      >
        <div>content</div>
      </CrossTabSyncProvider>,
    );

    expect(screen.getByText('content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an explicit recovery alert and clears it on acknowledgement', async () => {
    const bus = makeBus();
    render(
      <CrossTabSyncProvider
        options={{
          channel: channelFor(bus, 'tab-b'),
          senderId: 'tab-b',
          accountOverride: ACCOUNT_A,
          chainIdOverride: 10,
        }}
      >
        <div>content</div>
      </CrossTabSyncProvider>,
    );

    act(() => {
      bus.emit({
        v: 1,
        kind: 'wallet-context',
        reason: 'account-change',
        account: ACCOUNT_B,
        chainId: 10,
        epoch: 1,
        sender: 'tab-a',
        seq: 1,
        at: 1_700_000_000_001,
      });
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/account changed in another tab/i);

    await userEvent.click(screen.getByRole('button', { name: /i understand/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
