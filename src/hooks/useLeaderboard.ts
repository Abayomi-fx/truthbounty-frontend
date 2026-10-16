// src/hooks/useLeaderboard.ts
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../app/queries/queryKeys";
import { fetchLeaderboard } from "../app/api/leaderboard.api";
import { sortAndNormalizeLeaderboard } from "../lib/leaderboard";
import type { LeaderboardEntry } from "@/app/types/websocket";

export const useLeaderboard = () => {
  return useQuery<LeaderboardEntry[]>({
    queryKey: queryKeys.leaderboard,
    queryFn: fetchLeaderboard,
    staleTime: 1000 * 60 * 10, // 10 min
    refetchInterval: 1000 * 60 * 5, // auto-refresh every 5 min
    // The server is the source of truth for ranking. We only enforce protocol
    // invariants (sort by server rank + normalize dense ranks) on the client
    // without re-sorting by arbitrary fields.
    select: (data: LeaderboardEntry[]) => sortAndNormalizeLeaderboard(data),
  });
};