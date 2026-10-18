'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAccount, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { fetchRewardEntitlements } from '@/app/api/rewards.api';
import { getProtocolRelease } from '@/lib/contracts/registry';
import { validateRewardEntitlements } from '@/lib/rewards/validate-entitlements';
import type {
  RewardsCenterData,
  RewardEntry,
} from '@/components/features/rewards-center/model';

/** Read-only use of the existing API adapter. Shape validation is not authority. */
export function useRewardsCenterData() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { manifest } = getProtocolRelease();
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  const allowed = Boolean(
    isConnected && address && chainId === manifest.chainId,
  );
  const query = useQuery({
    queryKey: ['rewards-center', address, chainId, manifest.releaseId],
    queryFn: async () => {
      if (!allowed || !address) throw new Error('Rewards context unavailable');
      return validateRewardEntitlements(await fetchRewardEntitlements(address));
    },
    enabled: allowed && online,
    staleTime: 30_000,
    retry: 1,
  });
  const receivedAt = query.dataUpdatedAt || null;
  const entries: RewardEntry[] = allowed
    ? (query.data?.entitlements ?? []).map((entry) => ({
        id: `${entry.claimId}:${entry.asset}:${entry.category}`,
        claimId: entry.claimId,
        title: entry.category.replaceAll('_', ' '),
        outcome: 'accrued',
        amount: formatUnits(entry.amount, entry.decimals),
        // No token metadata adapter is pinned: retain exact asset identity.
        asset: entry.asset,
        source: {
          kind: 'api-projection',
          receivedAt,
          freshness: query.isStale ? 'stale' : 'unknown',
        },
      }))
    : [];
  const state: RewardsCenterData['state'] = !allowed
    ? 'denied'
    : !online
      ? 'offline'
      : query.isPending
        ? 'loading'
        : query.isError
          ? 'error'
          : query.isStale
            ? 'stale'
            : entries.length === 0
              ? 'empty'
              : 'ready';
  return {
    data: {
      state,
      entries,
      receivedAt: allowed ? receivedAt : null,
      rejectedCount: allowed ? (query.data?.rejectedCount ?? 0) : 0,
    } satisfies RewardsCenterData,
    refresh: () => {
      if (allowed && online) void query.refetch();
    },
    canRefresh: allowed && online && !query.isFetching,
  };
}
