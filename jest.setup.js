/* eslint-disable @typescript-eslint/no-require-imports -- jest env setup */
import '@testing-library/jest-dom';
import React from 'react';
import { queryClient } from './src/app/queries/queryClient';

// Polyfill TextEncoder/TextDecoder for libraries (e.g. viem) in the jsdom env.
// Node provides these; jsdom's global scope may not expose them to bundled code.
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('node:util')
  globalThis.TextEncoder = TextEncoder
  globalThis.TextDecoder = TextDecoder
}

if (typeof global.Request === 'undefined' && typeof globalThis.Request !== 'undefined') {
  global.Request = globalThis.Request;
  global.Response = globalThis.Response;
  global.Headers = globalThis.Headers;
}

// Mock WebSocket for testing
global.WebSocket = jest.fn(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1, // OPEN
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage with in-memory behavior so tests can observe persisted state.
const storage = new Map();
const localStorageMock = {
  getItem: jest.fn((key) => (storage.has(key) ? storage.get(key) : null)),
  setItem: jest.fn((key, value) => {
    storage.set(String(key), String(value));
  }),
  removeItem: jest.fn((key) => {
    storage.delete(String(key));
  }),
  clear: jest.fn(() => {
    storage.clear();
  }),
};
global.localStorage = localStorageMock;

// Mock window.matchMedia
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  notFound: jest.fn(),
}));

// Mock RainbowKit
jest.mock('@rainbow-me/rainbowkit', () => ({
  getDefaultConfig: jest.fn(() => ({
    chains: [
      { id: 10, name: 'OP Mainnet' },
      { id: 11155420, name: 'OP Sepolia' },
    ],
    transports: {},
  })),
  RainbowKitProvider: ({ children }) => children,
  darkTheme: jest.fn(() => ({})),
  lightTheme: jest.fn(() => ({})),
  ConnectButton: Object.assign(
    ({ label = 'Connect Wallet' }) => <button type="button">{label}</button>,
    {
      Custom: ({ children }) =>
        children({
          account: undefined,
          chain: undefined,
          openAccountModal: jest.fn(),
          openChainModal: jest.fn(),
          openConnectModal: jest.fn(),
          authenticationStatus: undefined,
          mounted: true,
        }),
    }
  ),
  useConnectModal: () => ({
    openConnectModal: jest.fn(),
  }),
}));

import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock Wagmi
jest.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E',
    isConnected: true,
    isConnecting: false,
    isDisconnected: false,
    chainId: 10,
    status: 'connected',
  }),
  useDisconnect: () => ({
    disconnect: jest.fn(),
    disconnectAsync: jest.fn().mockResolvedValue(undefined),
  }),
  useChainId: () => 10,
  useSwitchChain: () => ({
    switchChain: jest.fn(),
  }),
  usePublicClient: () => ({}),
  useWalletClient: () => ({}),
  useBlockNumber: jest.fn(() => ({ data: 100n })),
  useReadContract: jest.fn(() => ({ data: undefined, isLoading: false })),
  useWriteContract: jest.fn(() => ({ writeContractAsync: jest.fn().mockResolvedValue('0x' + '1'.repeat(64)) })),
  useWaitForTransactionReceipt: jest.fn(() => ({ data: null, isLoading: false })),
  useBalance: jest.fn(() => ({ data: { value: 1000000000000000000n, formatted: '1.0' }, isLoading: false })),
  useConnectors: () => [{ id: 'injected', name: 'Injected', type: 'injected' }],
  useConnect: () => ({ connect: jest.fn(), connectAsync: jest.fn().mockResolvedValue(undefined) }),
  WagmiProvider: ({ children }) => children,
  createStorage: jest.fn(() => ({})),
  cookieStorage: {},
  http: jest.fn(),
}));

jest.mock('wagmi/chains', () => ({
  optimism: {
    id: 10,
    name: 'OP Mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: ['https://mainnet.optimism.io'] } },
    blockExplorers: { default: { name: 'Etherscan', url: 'https://optimistic.etherscan.io' } },
  },
  optimismSepolia: {
    id: 11155420,
    name: 'OP Sepolia',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: ['https://sepolia.optimism.io'] } },
    blockExplorers: { default: { name: 'Etherscan', url: 'https://sepolia-optimism.etherscan.io' } },
  },
}));

// Increase timeout for integration test suites
jest.setTimeout(25000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  storage.clear();
  queryClient.clear();
});
