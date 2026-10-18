import { Skeleton } from "@/components/ui/skeleton"

export function ActiveClaimsTableSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading claims table"
      className="bg-[#18181b] rounded-xl p-6 border border-[#232329]"
    >
      <span className="sr-only">Loading claims table skeleton shimmer...</span>
      {/* Header with filters */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-16 rounded" />
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-32 rounded" />
          <Skeleton className="h-7 w-14 rounded" />
        </div>
      </div>

      {/* Table header */}
      <div className="border-b border-[#232329] py-2">
        <div className="grid grid-cols-6 gap-4">
          {["Claim", "Status", "Confidence", "Votes / Stake", "Time Left", "Actions"].map((_, i) => (
            <Skeleton key={i} className="h-4 w-16" />
          ))}
        </div>
      </div>

      {/* Table rows */}
      <div className="divide-y divide-[#232329]">
        {Array.from({ length: 5 }).map((_, rowIdx) => (
          <div key={rowIdx} className="py-3 grid grid-cols-6 gap-4 items-center">
            {/* Claim column - more complex */}
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-20" />
            </div>
            {/* Status */}
            <Skeleton className="h-4 w-16" />
            {/* Confidence */}
            <Skeleton className="h-4 w-12" />
            {/* Votes/Stake */}
            <Skeleton className="h-4 w-20" />
            {/* Time Left */}
            <Skeleton className="h-4 w-14" />
            {/* Actions */}
            <Skeleton className="h-7 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
