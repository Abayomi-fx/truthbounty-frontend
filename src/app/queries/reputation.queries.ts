// @ts-nocheck
/**
 * Query hooks for on-chain reputation scores.
 *
 * Reputation is an indexed projection of on-chain verification outcomes;
 * it must never be fabricated or incremented locally.
 *
 * The effective-weight review depends on contract-sourced stake and
 * reputation adjustment inputs. These hooks expose the projection data
 * with explicit freshness labels so the UI can render stale / unavailable
 * / inconsistent states without ever treating an estimate as authority.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { fetchUserReputation } from '../api/user.api';

export type ReputationFreshness = 'fresh' | 'stale' | 'unavailable';

export interface ReputationReading {
  /** Raw on-chain reputation score as reported by the indexer. */
  rawScore: bigint;
  /** Reputation adjustment input applied by the contract. */
  adjustmentInput: bigint;
  /** Effective value after adjustment (never a client-side estimate). */
  effectiveValue: bigint;
  /** Block number the reading was derived from. */
  blockNumber: number;
  /** Freshness label for the projection data. */
  freshness: ReputationFreshness;
  /** Timestamp of the last observed update. */
  updatedAt: number;
}

export function useReputationByUser(userId: string): UseQueryResult<ReputationReading, Error> {
  return useQuery({
    queryKey: queryKeys.reputation.byUser(userId),
    queryFn: () => fetchUserReputation(userId),
    enabled: !!userId,
    staleTime: 1000 * 60, // 1 min — refreshed via WS events

    /**
     * Reputation is projection data. It is never allowed to authorize a
     * mutation; the contract is canonical. We surface freshness so the
     * review component can disable authorization when data is stale,
     * unavailable, or inconsistent.
     */
    select: (data) => {
      const effective = data.rawScore + data.adjustmentInput;
      const inconsistent = data.effectiveValue !== effective;
      const freshness: ReputationFreshness = inconsistent
        ? 'unavailable'
        : data.freshness;
      return {
        ...data,
        effectiveValue: data.effectiveValue,
        freshness,
      };
    },
  });
}
