// src/hooks/useLeaderboard.ts
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../app/queries/queryKeys";
import { fetchLeaderboard } from "../app/api/leaderboard.api";
import { sortAndNormalizeLeaderboard } from "../lib/leaderboard";
import { useAdaptivePolling } from "./useReducedData";
import type { LeaderboardEntry } from "@/app/types/websocket";

export const useLeaderboard = () => {
  // UI-FE-082: leaderboard is a non-critical projection — its auto-refresh is
  // stretched while reduced-data mode is active. Ranking data is never treated
  // as security-critical, so deferral is safe here.
  const { pollInterval } = useAdaptivePolling({
    baseIntervalMs: 1000 * 60 * 5,
    critical: false,
  });

  return useQuery<LeaderboardEntry[]>({
    queryKey: queryKeys.leaderboard,
    queryFn: fetchLeaderboard,
    staleTime: 1000 * 60 * 10, // 10 min
    refetchInterval: pollInterval, // auto-refresh every 5 min (stretched under data saver)
    // The server is the source of truth for ranking. We only enforce protocol
    // invariants (sort by server rank + normalize dense ranks) on the client
    // without re-sorting by arbitrary fields.
    select: (data: LeaderboardEntry[]) => sortAndNormalizeLeaderboard(data),
  });
};