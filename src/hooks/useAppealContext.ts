/**
 * Hook for reading appeal participation context.
 *
 * The pinned `TruthBountyWeighted` ABI exposes no appeal-context getters, so
 * every value here comes from the canonical API projection via
 * `loadAppealProjection`. Nothing is derived from local clock, block
 * arithmetic or placeholder balances: an unavailable, incomplete or
 * inconsistent projection leaves `context` null and surfaces `error`, so
 * participation fails closed instead of acting on invented state.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import {
  AppealDeadline,
  AppealWalletPosition,
  AppealParticipationContext,
} from '@/app/types/appeal';
import { getReleaseChainId } from '@/lib/contracts/registry';
import {
  AppealProjectionError,
  loadAppealProjection,
  type AppealProjectionFetcher,
} from '@/lib/appeals/projection';

export interface UseAppealContextConfig {
  appealId: string;
  claimId: string;
  contractAddress: string;
  expectedChainId?: number;
  pollInterval?: number; // ms
  /** Injected projection transport; defaults to `GET /api/appeals/:appealId`. */
  fetcher?: AppealProjectionFetcher;
}

export interface AppealContextResult {
  context: AppealParticipationContext | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const DEFAULT_POLL_INTERVAL = 10000; // 10 seconds

/**
 * Fetch appeal participation context from the canonical API projection.
 * Fails closed whenever the projection cannot be trusted.
 */
export function useAppealContext(
  config: UseAppealContextConfig
): AppealContextResult {
  const {
    appealId,
    claimId,
    contractAddress,
    expectedChainId = getReleaseChainId(),
    pollInterval = DEFAULT_POLL_INTERVAL,
    fetcher,
  } = config;

  const { address: userAddress, isConnected } = useAccount();
  const currentChainId = useChainId();

  const [context, setContext] = useState<AppealParticipationContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The transport is read through a ref: callers commonly pass an inline
  // function, and keying the polling effect on its identity would restart the
  // interval (and refetch) on every render. Synced in an effect because React
  // disallows writing refs during render.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  /**
   * Validate basic connectivity and configuration
   */
  const validateConfiguration = useCallback((): string | null => {
    if (!isConnected || !userAddress) {
      return 'Wallet not connected';
    }

    if (currentChainId !== expectedChainId) {
      return `Wrong network. Expected chain ${expectedChainId}, got ${currentChainId}`;
    }

    if (!contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return 'Invalid contract address format';
    }

    if (!appealId || !claimId) {
      return 'Invalid appeal or claim ID';
    }

    return null;
  }, [isConnected, userAddress, currentChainId, expectedChainId, contractAddress, appealId, claimId]);

  /**
   * Compute eligibility based on all context data
   */
  const computeEligibility = useCallback(
    (
      deadline: AppealDeadline,
      position: AppealWalletPosition
    ): { isEligible: boolean; ineligibilityReason?: string } => {
      // Check if appeal is still active
      if (!deadline.isActive) {
        return {
          isEligible: false,
          ineligibilityReason: 'Appeal period has ended',
        };
      }

      // Check if user already participated
      if (position.hasParticipated) {
        return {
          isEligible: false,
          ineligibilityReason: 'You have already participated in this appeal',
        };
      }

      // Check if user has sufficient balance
      if (!position.hasMinimumBalance) {
        return {
          isEligible: false,
          ineligibilityReason: 'Insufficient balance to meet minimum stake requirement',
        };
      }

      return { isEligible: true };
    },
    []
  );

  /**
   * Main fetch logic - loads the canonical projection and assembles context.
   *
   * Eligibility is derived only from validated projection data. A transport,
   * shape or coherence failure clears the context and surfaces the reason, so
   * no caller can act on partially invented state.
   */
  const fetchContext = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const configError = validateConfiguration();
      if (configError) {
        setError(configError);
        setContext(null);
        setIsLoading(false);
        return;
      }

      if (!userAddress) {
        setError('Wallet not connected');
        setContext(null);
        setIsLoading(false);
        return;
      }

      const projection = await loadAppealProjection(appealId, {
        userAddress,
        expectedChainId,
        fetcher: fetcherRef.current,
      });

      if (projection.snapshot.claimId !== claimId) {
        throw new AppealProjectionError(
          'MALFORMED',
          `Projection claim ${projection.snapshot.claimId} does not match the requested claim ${claimId}.`
        );
      }

      const { isEligible, ineligibilityReason } = computeEligibility(
        projection.deadline,
        projection.walletPosition
      );

      setContext({
        snapshot: projection.snapshot,
        deadline: projection.deadline,
        stakeBounds: projection.stakeBounds,
        walletPosition: projection.walletPosition,
        isEligible,
        ineligibilityReason,
      });
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : 'Failed to fetch appeal context';
      setError(errorMsg);
      setContext(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    appealId,
    claimId,
    userAddress,
    expectedChainId,
    validateConfiguration,
    computeEligibility,
  ]);

  /**
   * Poll for context updates
   */
  useEffect(() => {
    const configError = validateConfiguration();
    if (configError) {
      setError(configError);
      setContext(null);
      return;
    }

    void fetchContext();
    const interval = setInterval(() => {
      void fetchContext();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [isConnected, userAddress, currentChainId, expectedChainId, contractAddress, appealId, claimId, fetchContext, pollInterval, validateConfiguration]);

  return {
    context,
    isLoading,
    error,
    refetch: fetchContext,
  };
}
