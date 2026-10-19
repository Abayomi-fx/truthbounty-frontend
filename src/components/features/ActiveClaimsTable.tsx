/**
 * ActiveClaimsTable — Presentational Component (V2-FE-109)
 *
 * Pure rendering component that displays claim projection data. This component
 * is data-agnostic: it accepts projection rows, filter state, pagination state,
 * and callbacks, but owns no query state itself.
 *
 * ## Data Ownership
 *
 * This component is **presentational only**. It does not:
 * - Fetch data from APIs
 * - Manage React Query state
 * - Own search/filter/pagination state
 *
 * For production usage, use ActiveClaimsTableContainer which owns the query.
 *
 * ## Testing
 *
 * - Component tests: Use ActiveClaimsTableContainer (see __tests__/ActiveClaimsTable.test.tsx)
 * - Storybook: Use this component directly with fixture data (see ActiveClaimsTable.stories.tsx)
 *
 * ## Props Contract
 *
 * All data comes via props. Stale data is visible but must be marked as stale.
 * Empty states distinguish between truly empty and filtered-empty projections.
 */

import React, { useRef } from "react";
import { getCategoryIcon } from "@/lib/category-icons";
import { ConfidenceMeter } from "@/components/ui/primitives/ConfidenceMeter";

export interface ActiveClaim {
  category: string;
  impact: string;
  title: string;
  source: string;
  status: string;
  confidence: number | null; // 0-100, null = unknown
  votes: string;
  stake: string;
  time: string;
  actions: string;
}

function formatConfidence(score: number | null): string {
  if (score === null) return '—';
  return `${score}%`;
}

function formatStatus(status: ClaimStatus): string {
  const statusMap: Record<ClaimStatus, string> = {
    OPEN: 'Open',
    UNDER_REVIEW: 'Under Review',
    VERIFIED: 'Verified',
    REJECTED: 'Rejected',
    DISPUTED: 'Disputed',
  };
  return statusMap[status] ?? status;
}

function getStatusColor(status: ClaimStatus): string {
  switch (status) {
    case 'VERIFIED':
      return 'text-green-400';
    case 'DISPUTED':
    case 'REJECTED':
      return 'text-red-400';
    case 'UNDER_REVIEW':
      return 'text-yellow-400';
    case 'OPEN':
    default:
      return 'text-blue-400';
  }
}

const ActiveClaimsTable = (props: ActiveClaimsTableProps) => {
  const {
    items,
    search,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    highImpactFilter,
    onHighImpactFilterChange,
    onClearFilters,
    hasActiveFilters,
    page,
    pageSize,
    total,
    totalPages,
    onPageChange,
    canGoNext,
    canGoPrevious,
    isStale,
    staleReason,
  } = props;

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const handleClearSearch = () => {
    onSearchChange("");
    searchInputRef.current?.focus();
  };

  const filters: Array<{ label: string; value: ClaimStatus | 'HighImpact' | 'All' }> = [
    { label: 'All', value: 'All' },
    { label: 'Open', value: 'OPEN' },
    { label: 'Verified', value: 'VERIFIED' },
    { label: 'Disputed', value: 'DISPUTED' },
    { label: 'High Impact', value: 'HighImpact' },
  ];

  const activeFilterValue = highImpactFilter
    ? 'HighImpact'
    : statusFilter ?? 'All';

  const handleFilterClick = (value: ClaimStatus | 'HighImpact' | 'All') => {
    if (value === 'HighImpact') {
      onHighImpactFilterChange(!highImpactFilter);
      onStatusFilterChange(undefined);
    } else if (value === 'All') {
      onStatusFilterChange(undefined);
      onHighImpactFilterChange(false);
    } else {
      onStatusFilterChange(value);
      onHighImpactFilterChange(false);
    }
  };

  const startIndex = (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, total);
  const rangeText = total > 0 ? `Showing ${startIndex}–${endIndex} of ${total} claims` : 'No claims';

  const isEmpty = items.length === 0;
  const isFilteredEmpty = isEmpty && hasActiveFilters;
  const isTrulyEmpty = isEmpty && !hasActiveFilters;

  return (
    <div className="bg-[#18181b] rounded-xl p-6 border border-[#232329]">
      {isStale && (
        <div role="alert" className="mb-4 rounded-md border border-amber-500/60 bg-amber-500/10 px-4 py-3">
          <p className="text-sm font-semibold text-white">Claim data may be out of date.</p>
          {staleReason && (
            <p className="mt-1 text-xs text-[#a1a1aa]">{staleReason}</p>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter claims">
          {filters.map((filter) => (
            <button
              key={filter.value}
              className={`px-3 py-1 rounded text-xs ${
                activeFilterValue === filter.value
                  ? "bg-[#232329] text-white"
                  : "bg-transparent text-[#a1a1aa] hover:text-white"
              }`}
              onClick={() => handleFilterClick(filter.value)}
              aria-pressed={activeFilterValue === filter.value}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="claims-search">
            Search claims
          </label>
          <div className="relative">
            <input
              id="claims-search"
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-[#232329] text-white px-2 py-1 pr-7 rounded text-xs"
              placeholder="Search claims..."
              aria-label="Search claims"
            />
            {search.length > 0 && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                title="Clear search"
                className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-5 h-5 rounded text-[#a1a1aa] hover:text-white hover:bg-[#3a3a42] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5b5bf6]"
              >
                <span aria-hidden="true" className="text-sm leading-none">
                  ×
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left" aria-label="Active claims">
          <thead>
            <tr className="text-[#a1a1aa] border-b border-[#232329]">
              <th scope="col" className="py-2">Claim</th>
              <th scope="col" className="py-2">Status</th>
              <th scope="col" className="py-2">Confidence</th>
              <th scope="col" className="py-2">Stake</th>
              <th scope="col" className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((item) => {
                const CategoryIcon = getCategoryIcon(item.category ?? 'General');
                return (
                  <tr
                    key={item.id}
                    className="border-b border-[#232329] hover:bg-[#232329]/40"
                  >
                    <td className="py-3">
                      <div className="flex flex-col">
                        <span className="text-xs text-[#5b5bf6] font-semibold flex items-center gap-1.5">
                          <CategoryIcon size={14} />
                          {item.category ?? 'General'}
                          {item.highImpact && (
                            <span className="ml-2 bg-[#232329] text-[#5b5bf6] px-2 py-0.5 rounded-full text-[10px]">
                              High Impact
                            </span>
                          )}
                        </span>
                        <span className="text-white font-medium leading-tight">
                          {item.title}
                        </span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className={getStatusColor(item.status)}>
                        {formatStatus(item.status)}
                      </span>
                    </td>
                    <td className="py-3">
                      <span title={item.confidenceScore === null ? 'Not yet scored' : undefined}>
                        {formatConfidence(item.confidenceScore)}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="text-[#a1a1aa]">{item.totalStaked.toLocaleString()}</span>
                    </td>
                    <td className="py-3">
                      <button
                        className="px-3 py-1 rounded bg-[#232329] text-xs text-white hover:bg-[#5b5bf6]"
                        aria-label={`View claim: ${item.title}`}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center text-sm text-[#a1a1aa]"
                >
                  {isTrulyEmpty && "No claims have been indexed yet."}
                  {isFilteredEmpty && (
                    <div>
                      <p className="mb-2">No claims match the current search or filter.</p>
                      <button
                        onClick={onClearFilters}
                        className="px-3 py-1 rounded bg-[#232329] text-xs text-white hover:bg-[#5b5bf6]"
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!isEmpty && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div aria-live="polite" aria-atomic="true" className="text-xs text-[#a1a1aa]">
            {rangeText}
          </div>
          <nav aria-label="Claims pagination" className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={!canGoPrevious}
              aria-label="Go to previous page"
              className="px-3 py-1 rounded bg-[#232329] text-xs text-white hover:bg-[#5b5bf6] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev !== undefined && p - prev > 1;
                return (
                  <React.Fragment key={p}>
                    {showEllipsis && <span className="text-[#a1a1aa] px-1">…</span>}
                    <button
                      onClick={() => onPageChange(p)}
                      aria-label={`Go to page ${p}`}
                      aria-current={p === page ? 'page' : undefined}
                      className={`px-3 py-1 rounded text-xs ${
                        p === page
                          ? "bg-[#5b5bf6] text-white"
                          : "bg-[#232329] text-white hover:bg-[#5b5bf6]"
                      }`}
                    >
                      <td className="py-3">
                        <div className="flex flex-col">
                          <span className="text-xs text-[#5b5bf6] font-semibold flex items-center gap-1.5">
                            <CategoryIcon size={14} />
                            {claim.category}
                            <span className="ml-2 bg-[#232329] text-[#5b5bf6] px-2 py-0.5 rounded-full text-[10px]">
                              {claim.impact}
                            </span>
                          </span>
                          <span className="text-white font-medium leading-tight">
                            {claim.title}
                          </span>
                          <span className="text-xs text-[#a1a1aa]">
                            {claim.source}
                          </span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span
                          className={
                            claim.status === "Verified"
                              ? "text-green-400"
                              : claim.status === "Under Review"
                              ? "text-yellow-400"
                              : "text-red-400"
                          }
                        >
                          {claim.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <ConfidenceMeter
                          value={claim.confidence}
                          label={`Confidence for ${claim.title}`}
                          showValue={true}
                          showBandLabel={false}
                        />
                      </td>
                      <td className="py-3">
                        {claim.votes}{" "}
                        <span className="text-[#a1a1aa]">/ {claim.stake}</span>
                      </td>
                      <td className="py-3">{claim.time}</td>
                      <td className="py-3">
                        <button
                          className="px-3 py-1 rounded bg-[#232329] text-xs text-white hover:bg-[#5b5bf6]"
                          aria-label={`${claim.actions} claim: ${claim.title}`}
                        >
                          {claim.actions}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-sm text-[#a1a1aa]"
                  >
                    {claims.length === 0
                      ? "No active claims at the moment."
                      : "No claims match the current search or filter. Try clearing your search or choosing a different filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ActiveClaimsTable;