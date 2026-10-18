import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useRewardsCenterData } from '../useRewardsCenterData';

let mockConnected = true;
let mockAddress: `0x${string}` = '0x1234567890123456789012345678901234567890';
let mockChain = 11155420;
let mockReleaseId = 'release-a';
jest.mock('wagmi', () => ({
  useAccount: () => ({ address: mockAddress, isConnected: mockConnected }),
  useChainId: () => mockChain,
}));
jest.mock('@/lib/contracts/registry', () => ({
  getProtocolRelease: () => ({
    manifest: { chainId: 11155420, releaseId: mockReleaseId },
  }),
}));

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return renderHook(() => useRewardsCenterData(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}
beforeEach(() => {
  mockConnected = true;
  mockChain = 11155420;
  mockReleaseId = 'release-a';
  mockAddress = '0x1234567890123456789012345678901234567890';
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: true,
  });
  (global.fetch as jest.Mock).mockReset().mockResolvedValue({
    ok: true,
    json: async () => [
      {
        claimId: '0x' + 'ab'.repeat(32),
        category: 'verification_reward',
        amount: '9007199254740993123456789012345678',
        asset: mockAddress,
        decimals: 18,
        claimable: true,
      },
    ],
  });
});

it('keeps API claimable flags as exact freshness-labelled estimates', async () => {
  const { result } = setup();
  await waitFor(() => expect(result.current.data.entries).toHaveLength(1));
  expect(result.current.data.entries[0]).toMatchObject({
    outcome: 'accrued',
    amount: '9007199254740993.123456789012345678',
    source: { kind: 'api-projection', freshness: 'unknown' },
  });
  expect(result.current.data.receivedAt).not.toBeNull();
});

it('invalidates account, chain and release contexts without displaying another wallet cache', async () => {
  const { result, rerender } = setup();
  await waitFor(() => expect(result.current.data.entries).toHaveLength(1));
  mockConnected = false;
  rerender();
  expect(result.current.data.state).toBe('denied');
  expect(result.current.data.entries).toEqual([]);
  mockConnected = true;
  mockChain = 1;
  rerender();
  expect(result.current.data.entries).toEqual([]);
  mockChain = 11155420;
  mockAddress = '0x2234567890123456789012345678901234567890';
  mockReleaseId = 'release-b';
  rerender();
  expect(result.current.data.entries).toEqual([]);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
});

it('does not fetch when disconnected or on a different chain', () => {
  mockChain = 10;
  const { result } = setup();
  expect(result.current.data.state).toBe('denied');
  expect(global.fetch).not.toHaveBeenCalled();
  result.current.refresh();
  expect(global.fetch).not.toHaveBeenCalled();
});

it('exposes invalid projection entries without promoting a partial result to a balance', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => [{ amount: 'NaN' }],
  });
  const { result } = setup();
  await waitFor(() => expect(result.current.data.rejectedCount).toBe(1));
  expect(result.current.data.entries).toEqual([]);
});
