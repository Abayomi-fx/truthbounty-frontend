'use client';

/**
 * useAdminDashboardData — V2-FE-154
 *
 * Hook coordinating authorized admin dashboard state:
 * - Server/API authorization and canonical contract authorization
 * - System health telemetry with source and freshness metadata
 * - Bounded operational queues with risk, authority, and consequence
 * - Immutable admin audit references
 * - Read-only protocol configuration loaded from canonical release artifacts
 * - Resilient states: unauthorized, stale, degraded, partial failure, empty queue
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount } from '@/hooks/useAccount';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useAppShellContext } from '@/context/AppShellContext';
import { getProtocolRelease } from '@/lib/contracts/registry';
import { fetchAdminOverview, executeAdminOperation } from '@/app/api/admin.api';
import type {
  AdminDashboardOverview,
  OperationalQueueItem,
  SystemHealthMetric,
  AdminAuditRecord,
  ReadOnlyProtocolParameter,
  ExecuteOperationResponse,
} from '@/app/types/admin';

export interface UseAdminDashboardDataReturn {
  isAuthorized: boolean;
  unauthorizedReason: string | null;
  canonicalAdminAddress: string;
  account: string | null;
  isConnected: boolean;
  isSupportedChain: boolean;
  isLoading: boolean;
  isStale: boolean;
  isDegraded: boolean;
  isOffline: boolean;
  isPartialFailure: boolean;
  partialFailureMessage: string | null;
  healthMetrics: SystemHealthMetric[];
  operationalQueue: OperationalQueueItem[];
  auditRecords: AdminAuditRecord[];
  readOnlyParameters: ReadOnlyProtocolParameter[];
  governanceNotices: AdminDashboardOverview['governanceNotices'];
  freshness: {
    lastUpdated: number;
    source: string;
    isFresh: boolean;
  };
  execute: (
    operationId: string,
    confirmationText: string
  ) => Promise<{ success: boolean; message: string; auditRecord?: AdminAuditRecord }>;
  refetch: () => Promise<void>;
}

export function useAdminDashboardData(): UseAdminDashboardDataReturn {
  const accountInfo = useAccount();
  const address = accountInfo?.address ?? null;
  const { isOnline } = useNetworkStatus();
  const { roles, isConnected, isSupportedChain } = useAppShellContext();

  const release = useMemo(() => getProtocolRelease(), []);
  const rawAdmin = useMemo(
    () => String(release.roles.admin || process.env.NEXT_PUBLIC_ADMIN_ADDRESS || ''),
    [release]
  );
  const canonicalAdmin = useMemo(
    () => rawAdmin.toLowerCase(),
    [rawAdmin]
  );

  const [overview, setOverview] = useState<AdminDashboardOverview | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastFetchedAt, setLastFetchedAt] = useState<number>(0);
  const [isPartialFailure, setIsPartialFailure] = useState<boolean>(false);
  const [partialFailureMessage, setPartialFailureMessage] = useState<string | null>(null);

  // Check authorization
  const authorizationCheck = useMemo(() => {
    if (!isConnected || !address) {
      return {
        isAuthorized: false,
        reason: 'Wallet disconnected. Connect authorized administrator address to access.',
      };
    }
    if (!isSupportedChain) {
      return {
        isAuthorized: false,
        reason: 'Unsupported network. Switch wallet to Optimism Mainnet or OP Sepolia.',
      };
    }
    const isContractAdmin = canonicalAdmin && address.toLowerCase() === canonicalAdmin;
    const isFrontendAdmin = roles.isAdmin;

    if (!isContractAdmin && !isFrontendAdmin) {
      return {
        isAuthorized: false,
        reason: 'Current address is not registered as the canonical protocol administrator.',
      };
    }

    return { isAuthorized: true, reason: null };
  }, [isConnected, address, isSupportedChain, canonicalAdmin, roles.isAdmin]);

  const loadOverview = useCallback(async () => {
    if (!authorizationCheck.isAuthorized || !address) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsPartialFailure(false);
    setPartialFailureMessage(null);

    try {
      const data = await fetchAdminOverview(address);
      setOverview(data);
      setLastFetchedAt(Date.now());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to synchronize admin overview';
      // If server returned 403 or network issue:
      setIsPartialFailure(true);
      setPartialFailureMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [authorizationCheck.isAuthorized, address]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const execute = useCallback(
    async (
      operationId: string,
      confirmationText: string
    ): Promise<{ success: boolean; message: string; auditRecord?: AdminAuditRecord }> => {
      if (!address) {
        return { success: false, message: 'Wallet not connected' };
      }

      try {
        const response: ExecuteOperationResponse = await executeAdminOperation({
          operationId,
          confirmationText,
          operatorAddress: address,
        });

        if (response.success && response.auditRecord) {
          // Update local state: remove operation from queue and append audit record
          setOverview((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              operationalQueue: prev.operationalQueue.filter((item) => item.id !== operationId),
              auditRecords: [response.auditRecord, ...prev.auditRecords],
            };
          });
          return {
            success: true,
            message: response.message,
            auditRecord: response.auditRecord,
          };
        }
        return { success: false, message: response.message || 'Operation failed' };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Operation execution error';
        return { success: false, message: msg };
      }
    },
    [address]
  );

  const isStale = useMemo(() => {
    if (!lastFetchedAt) return false;
    return Date.now() - lastFetchedAt > 45000;
  }, [lastFetchedAt]);

  const isDegraded = useMemo(() => {
    if (!overview) return false;
    return overview.healthMetrics.some(
      (m) => m.status === 'warning' || m.status === 'degraded' || m.status === 'unavailable'
    );
  }, [overview]);

  return {
    isAuthorized: authorizationCheck.isAuthorized,
    unauthorizedReason: authorizationCheck.reason,
    canonicalAdminAddress: rawAdmin,
    account: address,
    isConnected,
    isSupportedChain,
    isLoading,
    isStale,
    isDegraded,
    isOffline: !isOnline,
    isPartialFailure,
    partialFailureMessage,
    healthMetrics: overview?.healthMetrics || [],
    operationalQueue: overview?.operationalQueue || [],
    auditRecords: overview?.auditRecords || [],
    readOnlyParameters: overview?.readOnlyParameters || [],
    governanceNotices: overview?.governanceNotices || [],
    freshness: {
      lastUpdated: lastFetchedAt || Date.now(),
      source: 'Optimism L2 Registry & Indexer Supervisor',
      isFresh: !isStale && !isPartialFailure,
    },
    execute,
    refetch: loadOverview,
  };
}
