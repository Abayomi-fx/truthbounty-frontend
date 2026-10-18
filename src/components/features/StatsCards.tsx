"use client";
import React, { memo } from "react";
import { useTrust } from "@/components/hooks/useTrust";
import TrustScoreTooltip from "@/components/ui/TrustScoreTooltip";
import { StatsCardsSkeleton } from "@/components/skeletons";

interface StatItem {
  label: string;
  value: string;
}

interface StatsCardsProps {
  /** Live platform statistics from the indexer API. Renders em-dash placeholders when absent. */
  platformStats?: StatItem[];
  isLoading?: boolean;
}

const STAT_LABELS = [
  "Claims",
  "Verifications",
  "Votes Cast",
  "Unique Verifiers",
  "TVL",
  "Chains",
];

const StatsCards = memo(function StatsCards({
  platformStats,
  isLoading = false,
}: StatsCardsProps) {
  const trust = useTrust();

  // reputation is null when the API has not yet provided a value.
  // Never call .toString() on null — render the explicit placeholder instead.
  const userTrustValue =
    trust.reputation !== null ? trust.reputation.toString() : "—";

  const resolvedStats: StatItem[] =
    platformStats ?? STAT_LABELS.map((label) => ({ label, value: "—" }));

  const stats = [
    { label: "My Trust", value: userTrustValue, tooltip: true },
    ...resolvedStats,
  ];

  if (isLoading) {
    return <StatsCardsSkeleton />;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-[#18181b] rounded-xl p-6 flex flex-col items-center justify-center border border-[#232329]"
          aria-label={`${stat.label}: ${stat.value}`}
        >
          <div className="text-2xl font-bold text-white flex items-center">
            {stat.value}
            {"tooltip" in stat && stat.tooltip && (
              <span className="ml-2">
                <TrustScoreTooltip />
              </span>
            )}
          </div>
          <div className="text-xs text-[#a1a1aa] mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  );
});

export default StatsCards;
