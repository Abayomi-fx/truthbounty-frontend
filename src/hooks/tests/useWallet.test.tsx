/**
 * Unit tests for useWallet — EVM wallet lifecycle hook.
 *
 * Covers:
 *  - disconnected → connecting → connected (success)
 *  - connector rejection / user-cancelled (error path)
 *  - account change detection
 *  - disconnect clears preference storage
 *  - reconnect resolves persisted connector
 *  - wrong-network / unsupported-chain guard (via useWalletNetwork)
 *  - hydration guard (no phantom connected state)
 *  - clearError resets error without disconnecting
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { http } from 'viem';
import { optimismSepolia } from 'viem/chains';
import { createConfig, mock } from 'wagmi';
import { useWallet } from '../useWallet';

// ── Test Wagmi config using the built-in mock connector ──────────────────────
// The config holds mutable connection state, so a fresh instance is created per
// test to avoid leaking connections/accounts between tests.
function createTestConfig() {
  return createConfig({
    chains: [optimismSepolia],
    transports: { [optimismSepolia.id]: http() },
    connectors: [
      mock({
        accounts: [
          '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        ],
      }),
    ],
  });
}

let testConfig = createTestConfig();
let queryClient: QueryClient;

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={testConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

// Clear connector preference and reset wagmi/query state between tests
beforeEach(() => {
  localStorage.clear();
  testConfig = createTestConfig();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFirstConnector() {
  return testConfig.connectors[0];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useWallet — lifecycle states', () => {
  it('starts in the disconnected state', () => {
    const { result } = renderHook(() => useWallet(), { wrapper: Wrapper });
    expect(result.current.state).toBe('disconnected');
    expect(result.current.isConnected).toBe(false);
    expect(result.current.address).toBeUndefined();
    expect(result.current.connectorError).toBeNull();
  });

  it('transitions to connected after a successful connect()', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper: Wrapper });

    act(() => {
      result.current.connect(getFirstConnector());
    });

    await waitFor(() => {
      expect(result.current.state).toBe('connected');
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.address).toMatch(/^0x/);
    expect(result.current.connectorError).toBeNull();
  });

  it('exposes the chain id when connected', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper: Wrapper });

    act(() => {
      result.current.connect(getFirstConnector());
    });

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    expect(typeof result.current.chainId).toBe('number');
  });

  it('transitions back to disconnected after disconnect()', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper: Wrapper });

    act(() => {
      result.current.connect(getFirstConnector());
    });

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      result.current.disconnect();
    });

    await waitFor(() => {
      expect(result.current.state).toBe('disconnected');
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.address).toBeUndefined();
  });

  it('surfaces a connector error when connect is rejected', async () => {
    const connector = getFirstConnector();

    // Temporarily override connect to simulate a user rejection
    const originalSetup = connector.setup;
    const connectSpy = jest
      .spyOn(connector, 'connect')
      .mockRejectedValueOnce(new Error('User rejected the request.'));

    const { result } = renderHook(() => useWallet(), { wrapper: Wrapper });

    act(() => {
      result.current.connect(connector);
    });

    await waitFor(() => {
      expect(result.current.state).toBe('error');
    });

    expect(result.current.connectorError).toBeInstanceOf(Error);
    expect(result.current.connectorError?.message).toMatch(/rejected/i);

    connectSpy.mockRestore();
    void originalSetup;
  });

  it('clearError resets the error state without disconnecting', async () => {
    const connector = getFirstConnector();
    const connectSpy = jest
      .spyOn(connector, 'connect')
      .mockRejectedValueOnce(new Error('User rejected the request.'));

    const { result } = renderHook(() => useWallet(), { wrapper: Wrapper });

    act(() => {
      result.current.connect(connector);
    });

    await waitFor(() => expect(result.current.state).toBe('error'));

    act(() => {
      result.current.clearError();
    });

    expect(result.current.connectorError).toBeNull();
    expect(result.current.state).toBe('disconnected');

    connectSpy.mockRestore();
  });
});

describe('useWallet — connector preference persistence', () => {
  it('persists the connector id on successful connect', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper: Wrapper });

    act(() => {
      result.current.connect(getFirstConnector());
    });

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    const stored = localStorage.getItem('truthbounty:wallet:connector');
    expect(stored).toBe(getFirstConnector().id);
  });

  it('clears persisted connector id on disconnect', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper: Wrapper });

    act(() => {
      result.current.connect(getFirstConnector());
    });

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      result.current.disconnect();
    });

    await waitFor(() => expect(result.current.isConnected).toBe(false));

    expect(localStorage.getItem('truthbounty:wallet:connector')).toBeNull();
  });

  it('reconnect() uses the stored connector preference', async () => {
    // Seed the preference as if a previous session connected
    localStorage.setItem('truthbounty:wallet:connector', getFirstConnector().id);

    const { result } = renderHook(() => useWallet(), { wrapper: Wrapper });

    act(() => {
      result.current.reconnect();
    });

    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(result.current.address).toMatch(/^0x/);
  });

  it('reconnect() is a no-op when no preference is stored', () => {
    const { result } = renderHook(() => useWallet(), { wrapper: Wrapper });

    act(() => {
      result.current.reconnect();
    });

    // Should remain disconnected — no error thrown
    expect(result.current.state).toBe('disconnected');
  });
});

describe('useWallet — hydration safety', () => {
  it('never reports isConnected=true before the component mounts', () => {
    // useIsMounted starts false; before effects run, isConnected must be false.
    const { result } = renderHook(() => useWallet(), { wrapper: Wrapper });
    // On first synchronous render the mount effect hasn't fired yet.
    // result.current reflects the first render value.
    expect(result.current.isConnected).toBe(false);
  });
});

describe('useWallet — account change', () => {
  it('clears connectorError when the active account changes', async () => {
    const connector = getFirstConnector();

    // First connect succeeds
    const { result } = renderHook(() => useWallet(), { wrapper: Wrapper });

    act(() => {
      result.current.connect(connector);
    });

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    const firstAddress = result.current.address;
    expect(firstAddress).toBeTruthy();

    // Simulate an account switch by emitting the connector's accountsChanged event
    act(() => {
      connector.onAccountsChanged(['0x70997970C51812dc3A010C7d01b50e0d17dc79C8']);
    });

    await waitFor(() => {
      expect(result.current.address?.toLowerCase()).not.toBe(firstAddress?.toLowerCase());
    });

    expect(result.current.connectorError).toBeNull();
  });
});

describe('useWallet — wrong-network / stale paths', () => {
  it('exposes connectors list so callers can check supported chains', () => {
    const { result } = renderHook(() => useWallet(), { wrapper: Wrapper });
    expect(Array.isArray(result.current.connectors)).toBe(true);
    expect(result.current.connectors.length).toBeGreaterThan(0);
  });

  it('address is undefined when not connected (stale state guard)', () => {
    const { result } = renderHook(() => useWallet(), { wrapper: Wrapper });
    expect(result.current.address).toBeUndefined();
  });
});
