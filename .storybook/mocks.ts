/**
 * Storybook mock module for hooks that read wallet, trust, network, and
 * WebSocket state.
 *
 * Stories import from this module (via the `@/components/hooks/*` alias
 * mapped in Storybook's Vite config) so that no production adapter — wagmi,
 * viem, Worldcoin, WebSocket, or fetch — is ever invoked from a story.
 *
 * Unpinned actions render unavailable: components that depend on live
 * protocol mutations show their disabled / unavailable state.
 */

import { useStorybookFixture, type StorybookFixtureConfig } from './StorybookFixtureProvider';

// ─── useAccount (wagmi replacement) ─────────────────────────────────────────

export function useAccount() {
  const { wallet } = useStorybookFixture();
  if (wallet === 'disconnected') return null;
  return {
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E' as const,
    displayName: '0x742d…0eB1',
    chainId: 10,
    isConnected: true,
    isConnecting: false,
    isDisconnected: false,
  };
}

export function useDisconnect() {
  return Object.assign(() => {}, {
    disconnect: () => {},
    disconnectAsync: async () => {},
  });
}

// ─── useTrust ────────────────────────────────────────────────────────────────

export function useTrust() {
  const { trust } = useStorybookFixture();
  return trust;
}

export function useTrustForAddress(address?: string) {
  // Third-party trust lookups produce a deterministic value from the address.
  if (!address) return useTrust();
  let sum = 0;
  for (let i = 0; i < address.length; i++) sum += address.charCodeAt(i);
  return {
    isVerified: sum % 2 === 0,
    reputation: sum % 101,
    accountAgeDays: (sum % 30) + 1,
    suspicious: sum % 10 < 2,
  };
}

// ─── useNetworkStatus ────────────────────────────────────────────────────────

export function useNetworkStatus() {
  const { network } = useStorybookFixture();
  if (network === 'offline') {
    return { isOnline: false, saveData: false, effectiveType: null, isLowBandwidth: false };
  }
  if (network === 'low-bandwidth') {
    return { isOnline: true, saveData: true, effectiveType: '2g', isLowBandwidth: true };
  }
  return { isOnline: true, saveData: false, effectiveType: '4g', isLowBandwidth: false };
}

// ─── useWebSocketStatus ─────────────────────────────────────────────────────

export function useWebSocketStatus() {
  const { webSocket } = useStorybookFixture();
  const isConnected = webSocket === 'connected';
  return {
    isConnected,
    connectionState: webSocket,
    reconnectAttempts: webSocket === 'reconnecting' ? 1 : 0,
  };
}

// ─── useReducedMotion ────────────────────────────────────────────────────────

export function useReducedMotion() {
  const { reducedMotion } = useStorybookFixture();
  return reducedMotion;
}

// ─── usePrefersReducedMotion (V2-FE-071 hook variant) ────────────────────────

export function usePrefersReducedMotion() {
  return useReducedMotion();
}

export function prefersReducedMotion() {
  return useReducedMotion();
}

// ─── useUserVerification (Worldcoin replacement) ────────────────────────────

export function useUserVerification(_address: string) {
  const { trust } = useStorybookFixture();
  return {
    data: trust.isVerified ? { status: 'SUCCESS' } : { status: 'NONE' },
    isLoading: false,
    isError: false,
    error: null,
  };
}

// ─── useTheme ────────────────────────────────────────────────────────────────

export { useStorybookTheme as useTheme } from './StorybookFixtureProvider';
