'use client';

/**
 * ClaimDetailSkeleton — Loading state skeleton for claim detail view
 *
 * Accessible loading indicator with reduced-motion support.
 */

import { useReducedMotion } from '@/hooks/useReducedMotion';

export function ClaimDetailSkeleton() {
  const prefersReducedMotion = useReducedMotion();
  const pulseClass = prefersReducedMotion ? '' : 'animate-pulse';

  return (
    <div
      className="bg-[#18181b] border border-[#232329] rounded-xl p-4 sm:p-6 space-y-4"
      role="status"
      aria-busy="true"
      aria-label="Loading claim details"
    >
      {/* Header skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#232329] pb-4">
        <div className={`h-7 bg-gray-800 rounded w-3/4 ${pulseClass}`} />
        <div className={`h-6 bg-gray-800 rounded w-20 ${pulseClass}`} />
      </div>

      {/* Description skeleton */}
      <div className="space-y-2">
        <div className={`h-4 bg-gray-800 rounded w-20 ${pulseClass}`} />
        <div className={`h-4 bg-gray-800 rounded w-full ${pulseClass}`} />
        <div className={`h-4 bg-gray-800 rounded w-full ${pulseClass}`} />
        <div className={`h-4 bg-gray-800 rounded w-2/3 ${pulseClass}`} />
      </div>

      {/* Metadata skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-[#232329]">
        <div className={`h-4 bg-gray-800 rounded w-32 ${pulseClass}`} />
        <div className={`h-4 bg-gray-800 rounded w-24 ${pulseClass}`} />
      </div>

      {/* Verifications skeleton */}
      <div className="pt-4 border-t border-[#232329] space-y-2">
        <div className={`h-4 bg-gray-800 rounded w-32 ${pulseClass}`} />
        <div className={`h-20 bg-gray-800 rounded w-full ${pulseClass}`} />
      </div>

      {/* Actions skeleton */}
      <div className="flex gap-3 pt-4">
        <div className={`h-12 bg-gray-800 rounded flex-1 ${pulseClass}`} />
        <div className={`h-12 bg-gray-800 rounded flex-1 ${pulseClass}`} />
      </div>

      <span className="sr-only">Loading claim details, please wait…</span>
    </div>
  );
}
