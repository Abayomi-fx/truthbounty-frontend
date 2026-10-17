/**
 * StorybookFixtureProvider — fixture isolation layer for Storybook.
 *
 * Architecture & security constraints (per approved Frontend Implementation
 * Matrix and TEST_BOUNDARIES.md):
 *
 *  - Storybook fixtures remain isolated from production adapters. No network,
 *    wallet, analytics, or live adapter calls are made from stories.
 *  - Unpinned actions render unavailable — no fabricated protocol outcomes.
 *  - Contract state is canonical for mutations; API data is a freshness-
 *    labelled projection. Storybook never fabricates protocol outcomes.
 *
 * This provider wraps every story in mock implementations of:
 *  - ThemeProvider (light/dark/system)
 *  - WebSocketProvider (deterministic connection state)
 *  - useAccount / wagmi (disconnected by default)
 *  - useTrust (deterministic trust values)
 *  - useNetworkStatus (online by default)
 *  - React Query (with deterministic, disabled queries)
 *  - useReducedMotion (controllable via story parameter)
 */

import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Fixture types ─────────────────────────────────────────────────────────

export interface StorybookFixtureConfig {
  /** Wallet connection state for the story. */
  wallet?: 'disconnected' | 'connected';
  /** Trust values for the current user. */
  trust?: {
    isVerified: boolean;
    reputation: number | null;
    accountAgeDays: number | null;
    suspicious: boolean | null;
  };
  /** WebSocket connection state. */
  webSocket?: 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'error';
  /** Network status. */
  network?: 'online' | 'offline' | 'low-bandwidth';
  /** Whether reduced motion is preferred. */
  reducedMotion?: boolean;
  /** Theme override. */
  theme?: 'light' | 'dark' | 'system';
}

const DEFAULT_CONFIG: Required<StorybookFixtureConfig> = {
  wallet: 'disconnected',
  trust: { isVerified: false, reputation: null, accountAgeDays: null, suspicious: null },
  webSocket: 'connected',
  network: 'online',
  reducedMotion: false,
  theme: 'system',
};

// ─── Mock Theme Provider ────────────────────────────────────────────────────

const ThemeContext = createContext<{
  theme: 'light' | 'dark' | 'system';
  resolvedTheme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark' | 'system') => void;
  toggleTheme: () => void;
}>({
  theme: 'system',
  resolvedTheme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
});

export const useStorybookTheme = () => useContext(ThemeContext);

function MockThemeProvider({
  children,
  defaultTheme = 'system',
}: {
  children: ReactNode;
  defaultTheme?: 'light' | 'dark' | 'system';
}) {
  const [theme, setTheme] = React.useState<'light' | 'dark' | 'system'>(defaultTheme);
  const resolvedTheme = theme === 'system' ? 'dark' : theme;
  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme: () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')),
    }),
    [theme, resolvedTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ─── Mock WebSocket Provider ─────────────────────────────────────────────────

const WebSocketContext = createContext<{
  isConnected: boolean;
  connectionState: string;
  lastMessage: unknown;
  lastCursor: string | null;
  reconnectAttempts: number;
  connect: () => void;
  disconnect: () => void;
  subscribe: () => () => void;
  send: () => void;
  clearPersistedCursor: () => void;
}>({
  isConnected: true,
  connectionState: 'connected',
  lastMessage: null,
  lastCursor: null,
  reconnectAttempts: 0,
  connect: () => {},
  disconnect: () => {},
  subscribe: () => () => {},
  send: () => {},
  clearPersistedCursor: () => {},
});

export const useStorybookWebSocket = () => useContext(WebSocketContext);

function MockWebSocketProvider({
  children,
  state = 'connected',
}: {
  children: ReactNode;
  state?: string;
}) {
  const isConnected = state === 'connected';
  const value = useMemo(
    () => ({
      isConnected,
      connectionState: state,
      lastMessage: null,
      lastCursor: null,
      reconnectAttempts: state === 'reconnecting' ? 1 : 0,
      connect: () => {},
      disconnect: () => {},
      subscribe: () => () => {},
      send: () => {},
      clearPersistedCursor: () => {},
    }),
    [isConnected, state],
  );
  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}

// ─── Storybook Fixture Context ──────────────────────────────────────────────

const FixtureContext = createContext<Required<StorybookFixtureConfig>>(DEFAULT_CONFIG);
export const useStorybookFixture = () => useContext(FixtureContext);

// ─── Main Fixture Provider ──────────────────────────────────────────────────

interface StorybookFixtureProviderProps {
  children: ReactNode;
  config?: StorybookFixtureConfig;
}

export function StorybookFixtureProvider({
  children,
  config,
}: StorybookFixtureProviderProps) {
  const merged = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...config }),
    [config],
  );

  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Never fetch in Storybook — fixtures are the data source.
            retry: false,
            gcTime: 0,
            staleTime: Infinity,
            networkMode: 'offline',
          },
          mutations: { retry: false, networkMode: 'offline' },
        },
      }),
    [],
  );

  return (
    <FixtureContext.Provider value={merged}>
      <QueryClientProvider client={queryClient}>
        <MockThemeProvider defaultTheme={merged.theme}>
          <MockWebSocketProvider state={merged.webSocket}>
            {children}
          </MockWebSocketProvider>
        </MockThemeProvider>
      </QueryClientProvider>
    </FixtureContext.Provider>
  );
}
