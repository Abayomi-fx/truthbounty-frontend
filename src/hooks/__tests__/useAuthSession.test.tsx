import { act, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { clearAuthSession, getAuthSession, setAuthSession } from '@/lib/session-store';
import { useAuthSession } from '../useAuthSession';

const ADDRESS_A = '0x1111111111111111111111111111111111111111';
const ADDRESS_B = '0x2222222222222222222222222222222222222222';
const MAINNET = 10;
const SEPOLIA = 11155420;

const wagmiState = {
  address: ADDRESS_A as string | undefined,
  chainId: MAINNET,
  isConnected: true,
};

jest.mock('wagmi', () => ({
  useAccount: () => ({
    address: wagmiState.address,
    isConnected: wagmiState.isConnected,
  }),
  useChainId: () => wagmiState.chainId,
}));

let queryClient: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  clearAuthSession();
  wagmiState.address = ADDRESS_A;
  wagmiState.chainId = MAINNET;
  wagmiState.isConnected = true;
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

describe('useAuthSession', () => {
  it('starts unauthenticated with no stored session', () => {
    const { result } = renderHook(() => useAuthSession(), { wrapper });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.session).toBeNull();
    expect(result.current.scope).toEqual({ address: ADDRESS_A, chainId: MAINNET });
  });

  it('authenticates with a backend-issued token bound to the wallet scope', () => {
    const { result } = renderHook(() => useAuthSession(), { wrapper });

    act(() => {
      result.current.authenticate('token-abc');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.session?.token).toBe('token-abc');
    expect(result.current.session?.scope).toEqual({ address: ADDRESS_A, chainId: MAINNET });
    expect(getAuthSession()?.token).toBe('token-abc');
  });

  it('refuses to authenticate when the wallet is not connected', () => {
    wagmiState.isConnected = false;
    wagmiState.address = undefined;
    const { result } = renderHook(() => useAuthSession(), { wrapper });

    expect(() => result.current.authenticate('token-abc')).toThrow('AUTH_REQUIRES_WALLET');
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('refuses an empty token', () => {
    const { result } = renderHook(() => useAuthSession(), { wrapper });
    expect(() => result.current.authenticate('   ')).toThrow('AUTH_TOKEN_REQUIRED');
  });

  it('flips to unauthenticated when the connected account changes', () => {
    const { result, rerender } = renderHook(() => useAuthSession(), { wrapper });
    act(() => {
      result.current.authenticate('token-abc');
    });
    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      wagmiState.address = ADDRESS_B;
      rerender();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.session).toBeNull();
  });

  it('flips to unauthenticated when the required chain changes', () => {
    const { result, rerender } = renderHook(() => useAuthSession(), { wrapper });
    act(() => {
      result.current.authenticate('token-abc');
    });
    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      wagmiState.chainId = SEPOLIA;
      rerender();
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('flips to unauthenticated when the wallet disconnects', () => {
    const { result, rerender } = renderHook(() => useAuthSession(), { wrapper });
    act(() => {
      result.current.authenticate('token-abc');
    });

    act(() => {
      wagmiState.isConnected = false;
      wagmiState.address = undefined;
      rerender();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.scope).toBeNull();
  });

  it('restores a still-valid session from the store on mount', () => {
    setAuthSession('token-restored', { address: ADDRESS_A, chainId: MAINNET });
    const { result } = renderHook(() => useAuthSession(), { wrapper });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.session?.token).toBe('token-restored');
  });

  it('does not report a stored session that belongs to another scope', () => {
    setAuthSession('token-old', { address: ADDRESS_B, chainId: MAINNET });
    const { result } = renderHook(() => useAuthSession(), { wrapper });
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('logout clears the session and the query cache', () => {
    queryClient.setQueryData(['claims'], [{ id: 'c1' }]);
    const { result } = renderHook(() => useAuthSession(), { wrapper });
    act(() => {
      result.current.authenticate('token-abc');
    });

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(getAuthSession()).toBeNull();
    expect(queryClient.getQueryData(['claims'])).toBeUndefined();
  });
});
