'use client';

/**
 * useUpgradeReviewData — UI-FE-031
 *
 * Loads the operational queue snapshot used to cross-reference the
 * maintainer-declared upgrade candidate, then resolves the
 * upgrade/unpause review state with fail-closed semantics.
 *
 * The review is evidence-only: it never executes a candidate release.
 */

import { useEffect, useMemo, useState } from 'react';
import { useAccount } from '@/hooks/useAccount';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useAppShellContext } from '@/context/AppShellContext';
import { fetchAdminOverview } from '@/app/api/admin.api';
import { resolveUpgradeReview } from '@/lib/upgrade-review/upgrade-review';
import type {
  OperationalQueueItem,
} from '@/app/types/admin';
import type { UpgradeReviewSnapshot } from '@/lib/upgrade-review/types';

export interface UseUpgradeReviewDataReturn {
  isAuthorized: boolean;
  unauthorizedReason: string | null;
  account: string | null;
  operationalQueue: OperationalQueueItem[];
  review: UpgradeReviewSnapshot;
  isLoading: boolean;
  loadError: string | null;
}

export function useUpgradeReviewData(): UseUpgradeReviewDataReturn {
  const accountInfo = useAccount();
  const address = accountInfo?.address ?? null;
  const { isOnline } = useNetworkStatus();
  const { roles, isConnected, isSupportedChain } = useAppShellContext();

  const [operationalQueue, setOperationalQueue] = useState<OperationalQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canonicalAdmin =
    process.env.NEXT_PUBLIC_ADMIN_ADDRESS?.toLowerCase() ?? null;

  const authorizationCheck = useMemo(() => {
    if (!isConnected || !address) {
      return {
        isAuthorized: false,
        reason: 'Wallet disconnected. Connect an authorized administrator address to review upgrades.',
      };
    }
    if (!isSupportedChain) {
      return {
        isAuthorized: false,
        reason: 'Unsupported network. Switch to an Optimism-compatible network.',
      };
    }
    const isContractAdmin =
      canonicalAdmin !== null && address.toLowerCase() === canonicalAdmin;
    const isFrontendAdmin = roles.isAdmin;
    if (!isContractAdmin && !isFrontendAdmin) {
      return {
        isAuthorized: false,
        reason: 'Current address is not registered as the canonical protocol administrator.',
      };
    }
    return { isAuthorized: true, reason: null };
  }, [isConnected, address, isSupportedChain, canonicalAdmin, roles.isAdmin]);

  useEffect(() => {
    if (!authorizationCheck.isAuthorized || !address) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    const load = async () => {
      try {
        const overview = await fetchAdminOverview(address);
        if (cancelled) return;
        setOperationalQueue(overview.operationalQueue);
      } catch (err: unknown) {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : 'Failed to synchronize operational queue.',
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorizationCheck.isAuthorized, address, isOnline]);

  const review = useMemo(() => {
    return resolveUpgradeReview({
      operationalQueue,
    });
  }, [operationalQueue]);

  return {
    isAuthorized: authorizationCheck.isAuthorized,
    unauthorizedReason: authorizationCheck.reason,
    account: address,
    operationalQueue,
    review,
    isLoading,
    loadError,
  };
}
