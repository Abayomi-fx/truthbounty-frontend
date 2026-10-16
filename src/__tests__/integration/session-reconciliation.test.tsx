/**
 * V2-FE-008 — Integration test at the wallet / provider boundary.
 *
 * Renders the real `QueryProvider` (WebSocketProvider + SessionReconciler)
 * with a mocked wagmi wallet and a controllable WebSocket, then verifies the
 * coordinated behavior:
 *
 *  - a valid wallet-scoped session authenticates the realtime stream
 *  - when the account or required chain changes, the auth session is
 *    invalidated, the query cache is cleared, and the stream is re-established
 *    WITHOUT the stale token (no AUTHENTICATE, no Authorization header on the
 *    HTTP catch-up)
 *  - disconnecting clears the session and drops auth from the stream
 */

import type { ReactElement } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { queryClient } from '@/app/queries/queryClient';
import { clearAuthSession, getAuthSession, setAuthSession } from '@/lib/session-store';

const ADDRESS_A = '0x1111111111111111111111111111111111111111';
const ADDRESS_B = '0x2222222222222222222222222222222222222222';
const MAINNET = 10;
const SEPOLIA = 11155420;

// --- Controllable WebSocket -------------------------------------------------

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static OPEN = 1;

  url: string;
  readyState = 0; // CONNECTING
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { wasClean: boolean; code: number }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code = 1000, _reason?: string) {
    this.closed = true;
    this.readyState = 3;
    this.onclose?.({ wasClean: code === 1000, code });
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }
}

const originalWebSocket = global.WebSocket;

function connectSocket(instance: FakeWebSocket) {
  act(() => {
    instance.open();
  });
}

function sentAuth(socket: FakeWebSocket): string | null {
  const auth = socket.sent.find((message) => message.includes('AUTHENTICATE'));
  if (!auth) return null;
  return JSON.parse(auth).token as string;
}

// --- Mocked wagmi wallet ----------------------------------------------------

const wagmiState = {
  address: ADDRESS_A as string | undefined,
  chainId: MAINNET,
  isConnected: true,
  isDisconnected: false,
  status: 'connected' as 'connected' | 'connecting' | 'reconnecting' | 'disconnected',
  disconnect: jest.fn(),
  reconnect: jest.fn(),
};

jest.mock('wagmi', () => ({
  useAccount: () => ({
    address: wagmiState.address,
    isConnected: wagmiState.isConnected,
    isDisconnected: wagmiState.isDisconnected,
    status: wagmiState.status,
  }),
  useChainId: () => wagmiState.chainId,
  useDisconnect: () => ({ disconnect: wagmiState.disconnect }),
  useReconnect: () => ({ reconnect: wagmiState.reconnect }),
}));

function setConnected(address: string, chainId: number) {
  wagmiState.address = address;
  wagmiState.chainId = chainId;
  wagmiState.isConnected = true;
  wagmiState.isDisconnected = false;
  wagmiState.status = 'connected';
}

function setDisconnected() {
  wagmiState.address = undefined;
  wagmiState.isConnected = false;
  wagmiState.isDisconnected = true;
  wagmiState.status = 'disconnected';
}

// --- Setup ------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  clearAuthSession();
  queryClient.clear();
  FakeWebSocket.instances = [];
  global.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => [],
  });
  setConnected(ADDRESS_A, MAINNET);
});

afterEach(() => {
  global.WebSocket = originalWebSocket;
  (global.fetch as jest.Mock).mockReset();
});

function providersTree() {
  return (
    <QueryProvider>
      <div data-testid="content" />
    </QueryProvider>
  );
}

async function renderProviders() {
  const view = render(providersTree());
  // Auto-connect happens on mount.
  await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0));
  return view;
}

/** Mutate the mocked wallet state and re-render the tree so hooks re-run. */
function updateWallet(mutate: () => void, rerender: (ui: ReactElement) => void) {
  act(() => {
    mutate();
    rerender(providersTree());
  });
}

describe('wallet/chain/auth session reconciliation (provider boundary)', () => {
  it('authenticates the stream with a still-valid wallet-scoped session', async () => {
    setAuthSession('token-1', { address: ADDRESS_A, chainId: MAINNET });
    window.localStorage.setItem('truthbounty:ws:cursor', 'cursor-1');

    await renderProviders();
    connectSocket(FakeWebSocket.instances[0]);

    await waitFor(() => {
      expect(FakeWebSocket.instances[0].sent).toContainEqual(
        expect.stringContaining('AUTHENTICATE'),
      );
    });
    expect(sentAuth(FakeWebSocket.instances[0])).toBe('token-1');

    // HTTP catch-up is authenticated with the same still-valid token.
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/claims/catchup?from=cursor-1'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer token-1' },
      }),
    );
  });

  it('invalidates auth, clears the query cache and drops auth from the stream on chain change', async () => {
    setAuthSession('token-1', { address: ADDRESS_A, chainId: MAINNET });
    queryClient.setQueryData(['claims'], [{ id: 'c1' }]);
    window.localStorage.setItem('truthbounty:ws:cursor', 'cursor-1');

    const view = await renderProviders();
    connectSocket(FakeWebSocket.instances[0]);
    expect(sentAuth(FakeWebSocket.instances[0])).toBe('token-1');

    // Switch to Sepolia while connected.
    updateWallet(() => setConnected(ADDRESS_A, SEPOLIA), view.rerender);
    await waitFor(() => expect(FakeWebSocket.instances.length).toBe(2));
    const reconnected = FakeWebSocket.instances[1];

    // The old socket is torn down and a new one is created for the new scope.
    expect(FakeWebSocket.instances[0].closed).toBe(true);

    connectSocket(reconnected);

    // The stale token must never be presented again — no AUTHENTICATE frame,
    // and the HTTP catch-up carries no Authorization header.
    expect(reconnected.sent.filter((m) => m.includes('AUTHENTICATE'))).toEqual([]);
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/claims/catchup'),
      expect.objectContaining({ headers: {} }),
    );

    // Auth session + query cache were invalidated by the reconciler.
    expect(getAuthSession()).toBeNull();
    expect(queryClient.getQueryData(['claims'])).toBeUndefined();
    // Chain-scoped storage and the resumable cursor were dropped.
    expect(window.localStorage.getItem('truthbounty:ws:cursor')).toBeNull();
  });

  it('invalidates auth and drops auth from the stream when the account changes', async () => {
    setAuthSession('token-1', { address: ADDRESS_A, chainId: MAINNET });

    const view = await renderProviders();
    connectSocket(FakeWebSocket.instances[0]);
    expect(sentAuth(FakeWebSocket.instances[0])).toBe('token-1');

    updateWallet(() => setConnected(ADDRESS_B, MAINNET), view.rerender);
    await waitFor(() => expect(FakeWebSocket.instances.length).toBe(2));
    const reconnected = FakeWebSocket.instances[1];
    connectSocket(reconnected);

    expect(getAuthSession()).toBeNull();
    expect(sentAuth(reconnected)).toBeNull();
  });

  it('clears the session and drops auth from the stream on disconnect', async () => {
    setAuthSession('token-1', { address: ADDRESS_A, chainId: MAINNET });

    const view = await renderProviders();
    connectSocket(FakeWebSocket.instances[0]);
    expect(sentAuth(FakeWebSocket.instances[0])).toBe('token-1');

    updateWallet(() => setDisconnected(), view.rerender);
    await waitFor(() => expect(FakeWebSocket.instances.length).toBe(2));
    const reconnected = FakeWebSocket.instances[1];
    connectSocket(reconnected);

    expect(getAuthSession()).toBeNull();
    expect(sentAuth(reconnected)).toBeNull();
  });
});
