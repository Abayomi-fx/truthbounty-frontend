/**
 * ActiveClaimsTableContainer — Query-Owning Boundary (V2-FE-109)
 *
 * This container owns the canonical claims list projection query. It manages
 * search, filters, pagination, and maps query states to view states, then
 * delegates pure rendering to the presentational ActiveClaimsTable.
 *
 * All tests exercising query behavior should use this container, not the
 * presentational component directly.
 */

import React from 'react';
import ActiveClaimsTable from './ActiveClaimsTable';
import { ActiveClaimsTableSkeleton } from '@/components/skeletons';
import { useClaimsList } from '@/hooks/useClaimsList';

export interface ActiveClaimsTableContainerProps {
  /** Override default page size (defaults to 10). */
  pageSize?: number;
}

function ErrorState({ error, onRetry }: { error: { code: string; message: string } | null; onRetry: () => void }) {
  return (
    <div className="bg-[#18181b] rounded-xl p-6 border border-[#232329]">
      <div role="alert" className="py-12 text-center">
        <p className="text-sm font-semibold text-white mb-2">
          Failed to load claims
        </p>
        <p className="text-xs text-[#a1a1aa] mb-1">
          {error?.code === 'PROJECTION_UNAVAILABLE' && 'Could not reach the claims projection service'}
          {error?.code === 'PROJECTION_MALFORMED' && 'Claims projection returned invalid data'}
          {error?.code === 'PROJECTION_STALE' && 'The claims projection is temporarily unavailable'}
          {error?.code === 'UNSUPPORTED_REQUEST' && 'This query is not supported'}
          {(!error?.code || error.code === 'UNKNOWN') && 'An unexpected error occurred'}
        </p>
        <p className="text-xs text-[#a1a1aa] font-mono mb-4">
          {error?.code ?? 'PROJECTION_UNAVAILABLE'}
        </p>
        <button
          onClick={onRetry}
          className="px-4 py-2 rounded bg-[#5b5bf6] text-xs text-white hover:bg-[#4a4ae0]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export function ActiveClaimsTableContainer(props: ActiveClaimsTableContainerProps = {}) {
  const {
    viewState,
    envelope,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    highImpactFilter,
    setHighImpactFilter,
    clearFilters,
    hasActiveFilters,
    page,
    setPage,
    canGoNext,
    canGoPrevious,
    refetch,
  } = useClaimsList({ pageSize: props.pageSize });

  // Loading state: no data yet
  if (viewState === 'loading') {
    return <ActiveClaimsTableSkeleton />;
  }

  // Error state: show recoverable error UI
  if (viewState === 'error') {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  // All other states: render the table with available data
  const items = envelope?.items ?? [];
  const pagination = envelope?.pagination ?? {
    page: 1,
    pageSize: props.pageSize ?? 10,
    total: 0,
    totalPages: 1,
  };
  const projection = envelope?.projection;

  const isStale = viewState === 'ready-stale';

  return (
    <ActiveClaimsTable
      items={items}
      search={search}
      onSearchChange={setSearch}
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
      highImpactFilter={highImpactFilter}
      onHighImpactFilterChange={setHighImpactFilter}
      onClearFilters={clearFilters}
      hasActiveFilters={hasActiveFilters}
      page={pagination.page}
      pageSize={pagination.pageSize}
      total={pagination.total}
      totalPages={pagination.totalPages}
      onPageChange={setPage}
      canGoNext={canGoNext}
      canGoPrevious={canGoPrevious}
      isStale={isStale}
      staleReason={projection?.reason}
    />
  );
}

export default ActiveClaimsTableContainer;
