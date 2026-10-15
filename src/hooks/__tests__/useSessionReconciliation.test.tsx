import { act, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  clearAuthSession,
  getAuthSession,
  isAuthSessionValidFor,
  setAuthSession,
} from '@/lib/session-store';
import { useSessionReconciliation } from '../useSessionReconciliation';

const ADDRESS_A = '0x1111111111111111111111111111111111111111';
const ADDRESS_B = '0x2222222222222222222222222222222222222222';
const MAINNET = 10;
const SEPOLIA = 11155420;

type WagmiStatus = 'connected' | 'connecting' | 'reconnecting' | 'disconnected';

// Mutable wagmi state consumed by the mocked hooks below.
const wagmiState = {
  address: ADDRESS_A as string | undefined,
  chainId: MAINNET,
  isConnected: true,
  isDisconnected: false,
  status: 'connected' as WagmiStatus,
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
  wagmiState.chainId = MAINNET;
  wagmiState.isConnected = false;
  wagmiState.isDisconnected = true;
  wagmiState.status = 'disconnected';
}

let queryClient: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  clearAuthSession();
  wagmiState.disconnect.mockClear();
  wagmiState.reconnect.mockClear();
  setConnected(ADDRESS_A, MAINNET);
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

describe('useSessionReconciliation', () => {
  it('does not clear a valid session or cache on first observation (baseline)', () => {
    setAuthSession('token-1', { address: ADDRESS_A, chainId: MAINNET });
    queryClient.setQueryData(['claims'], [{ id: 'c1' }]);

    const { result } = renderHook(() => useSessionReconciliation(), { wrapper });

    expect(getAuthSession()?.token).toBe('token-1');
    expect(queryClient.getQueryData(['claims'])).toEqual([{ id: 'c1' }]);
    expect(result.current.hasValidSession).toBe(true);
    expect(result.current.sessionScope).toEqual({ address: ADDRESS_A, chainId: MAINNET });
    expect(result.current.lastInvalidation).toBeNull();
  });

  it('invalidates auth and clears the query cache when the account changes', () => {
    setAuthSession('token-1', { address: ADDRESS_A, chainId: MAINNET });
    queryClient.setQueryData(['user', ADDRESS_A], { reputation: 10 });

    const { result, rerender } = renderHook(() => useSessionReconciliation(), { wrapper });
    expect(getAuthSession()?.token).toBe('token-1');

    act(() => {
      setConnected(ADDRESS_B, MAINNET);
      rerender();
    });

    expect(getAuthSession()).toBeNull();
    expect(queryClient.getQueryData(['user', ADDRESS_A])).toBeUndefined();
    expect(result.current.lastInvalidation?.reason).toBe('account-changed');
    expect(result.current.hasValidSession).toBe(false);
  });

  it('invalidates auth and clears caches when the required chain changes', () => {
    setAuthSession('token-1', { address: ADDRESS_A, chainId: MAINNET });
    queryClient.setQueryData(['claims'], [{ id: 'c1' }]);
    window.localStorage.setItem('truthbounty:chain', 'cached');
    window.localStorage.setItem('truthbounty:ws:cursor', 'cursor-1');

    const { result, rerender } = renderHook(() => useSessionReconciliation(), { wrapper });

    act(() => {
      setConnected(ADDRESS_A, SEPOLIA);
      rerender();
    });

    expect(getAuthSession()).toBeNull();
    expect(queryClient.getQueryData(['claims'])).toBeUndefined();
    expect(window.localStorage.getItem('truthbounty:chain')).toBeNull();
    expect(window.localStorage.getItem('truthbounty:ws:cursor')).toBeNull();
    expect(result.current.lastInvalidation?.reason).toBe('chain-changed');
  });

  it('clears auth and cache when the wallet disconnects', () => {
    setAuthSession('token-1', { address: ADDRESS_A, chainId: MAINNET });
    queryClient.setQueryData(['user', ADDRESS_A], { reputation: 10 });

    const { result, rerender } = renderHook(() => useSessionReconciliation(), { wrapper });

    act(() => {
      setDisconnected();
      rerender();
    });

    expect(getAuthSession()).toBeNull();
    expect(queryClient.getQueryData(['user', ADDRESS_A])).toBeUndefined();
    expect(result.current.lastInvalidation?.reason).toBe('disconnected');
    expect(result.current.sessionScope).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });

  it('preserves a still-valid session across a wagmi reconnect (page reload)', () => {
    // Mount in the connecting state (no address yet), as after a reload.
    act(() => {
      wagmiState.status = 'connecting';
      wagmiState.isConnected = false;
      wagmiState.address = undefined;
    });
    const { result, rerender } = renderHook(() => useSessionReconciliation(), { wrapper });

    // Session from the previous visit is still in storage for this scope.
    setAuthSession('token-1', { address: ADDRESS_A, chainId: MAINNET });

    act(() => {
      setConnected(ADDRESS_A, MAINNET);
      rerender();
    });

    // Reconnecting to the same scope must NOT wipe the session.
    expect(getAuthSession()?.token).toBe('token-1');
    expect(result.current.hasValidSession).toBe(true);
  });

  it('clears a stale session when reconnect lands on a different account', () => {
    setAuthSession('token-1', { address: ADDRESS_A, chainId: MAINNET });

    act(() => {
      wagmiState.status = 'connecting';
      wagmiState.isConnected = false;
      wagmiState.address = undefined;
    });
    const { result, rerender } = renderHook(() => useSessionReconciliation(), { wrapper });

    act(() => {
      setConnected(ADDRESS_B, MAINNET);
      rerender();
    });

    expect(getAuthSession()).toBeNull();
    expect(result.current.hasValidSession).toBe(false);
  });

  it('logout disconnects the wallet and clears auth + query cache', () => {
    setAuthSession('token-1', { address: ADDRESS_A, chainId: MAINNET });
    queryClient.setQueryData(['claims'], [{ id: 'c1' }]);

    const { result } = renderHook(() => useSessionReconciliation(), { wrapper });

    act(() => {
      result.current.logout();
    });

    expect(wagmiState.disconnect).toHaveBeenCalledTimes(1);
    expect(getAuthSession()).toBeNull();
    expect(queryClient.getQueryData(['claims'])).toBeUndefined();
  });

  it('reauthenticate drops the stale token without clearing unrelated cache', () => {
    setAuthSession('token-1', { address: ADDRESS_A, chainId: MAINNET });
    queryClient.setQueryData(['claims'], [{ id: 'c1' }]);

    const { result } = renderHook(() => useSessionReconciliation(), { wrapper });

    act(() => {
      result.current.reauthenticate();
    });

    expect(getAuthSession()).toBeNull();
    // invalidateQueries keeps data in the cache (marks stale); only the token is dropped.
    expect(queryClient.getQueryData(['claims'])).toEqual([{ id: 'c1' }]);
    expect(result.current.hasValidSession).toBe(false);
  });

  it('reconnect() delegates to the wagmi reconnect action', () => {
    const { result } = renderHook(() => useSessionReconciliation(), { wrapper });

    act(() => {
      result.current.reconnect();
    });

    expect(wagmiState.reconnect).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the scope is unchanged across renders', () => {
    setAuthSession('token-1', { address: ADDRESS_A, chainId: MAINNET });
    queryClient.setQueryData(['claims'], [{ id: 'c1' }]);

    const { result, rerender } = renderHook(() => useSessionReconciliation(), { wrapper });

    act(() => {
      rerender();
    });

    expect(getAuthSession()?.token).toBe('token-1');
    expect(queryClient.getQueryData(['claims'])).toEqual([{ id: 'c1' }]);
    expect(result.current.lastInvalidation).toBeNull();
  });

  it('reports isReconnecting while the wallet is connecting', () => {
    const { result, rerender } = renderHook(() => useSessionReconciliation(), { wrapper });

    act(() => {
      wagmiState.status = 'connecting';
      wagmiState.isConnected = false;
      rerender();
    });

    expect(result.current.isReconnecting).toBe(true);
  });

  it('exposes hasValidSession only while the stored session matches the scope', () => {
    const { result, rerender } = renderHook(() => useSessionReconciliation(), { wrapper });
    expect(result.current.hasValidSession).toBe(false);

    act(() => {
      setAuthSession('token-1', { address: ADDRESS_A, chainId: MAINNET });
      rerender();
    });

    expect(result.current.hasValidSession).toBe(true);
    expect(isAuthSessionValidFor({ address: ADDRESS_A, chainId: MAINNET })).toBe(true);
  });
});
