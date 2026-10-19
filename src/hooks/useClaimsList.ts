/**
 * Canonical claims list projection hook (V2-FE-109)
 *
 * Owns all query state for the claims list: search, filters, pagination, sort.
 * Maps React Query internals to explicit view states so presentational
 * components never branch on isLoading/isFetching themselves.
 *
 * This is the single source of truth for claim list fetching in the UI.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { fetchClaimsList } from '@/app/api/claims.api';
import { queryKeys } from '@/app/queries/queryKeys';
import type {
  ClaimsListEnvelope,
  ClaimsListError,
  ClaimsListParams,
  ClaimsListViewState,
} from '@/app/types/claim-list';
import type { ClaimStatus } from '@/app/types/claim';

const DEFAULTS = {
  pageSize: 10,
  debounceMs: 250,
  staleAfterMs: 60_000,
};

export interface UseClaimsListParams {
  initialPage?: number;
  pageSize?: number;
}

export interface UseClaimsListResult {
  // View state
  viewState: ClaimsListViewState;
  envelope: ClaimsListEnvelope | undefined;
  error: ClaimsListError | null;

  // Search & filters
  search: string;
  setSearch: (value: string) => void;
  statusFilter: ClaimStatus | undefined;
  setStatusFilter: (status: ClaimStatus | undefined) => void;
  highImpactFilter: boolean;
  setHighImpactFilter: (value: boolean) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;

  // Pagination
  page: number;
  setPage: (page: number) => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
  goNext: () => void;
  goPrevious: () => void;

  // Actions
  refetch: () => void;
}

function deriveViewState(
  isPending: boolean,
  isError: boolean,
  envelope: ClaimsListEnvelope | undefined,
): ClaimsListViewState {
  if (isPending && !envelope) return 'loading';
  if (isError && !envelope) return 'error';
  if (!envelope) return 'empty';
  if (envelope.projection.freshness === 'stale' || envelope.projection.freshness === 'degraded') {
    return 'ready-stale';
  }
  if (envelope.items.length === 0) return 'empty';
  return 'ready';
}

export function useClaimsList(params: UseClaimsListParams = {}): UseClaimsListResult {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | undefined>(undefined);
  const [highImpactFilter, setHighImpactFilter] = useState(false);
  const [page, setPage] = useState(params.initialPage ?? 1);

  const debouncedSearch = useDebounce(search, DEFAULTS.debounceMs);

  const queryParams: ClaimsListParams = useMemo(
    () => ({
      search: debouncedSearch,
      filters: {
        status: statusFilter,
        highImpact: highImpactFilter || undefined,
      },
      pagination: {
        page,
        pageSize: params.pageSize ?? DEFAULTS.pageSize,
      },
      sort: {
        field: 'createdAt',
        direction: 'desc',
      },
    }),
    [debouncedSearch, statusFilter, highImpactFilter, page, params.pageSize]
  );

  const queryResult = useQuery<ClaimsListEnvelope, ClaimsListError>({
    queryKey: queryKeys.claims.list(queryParams),
    queryFn: ({ signal }) => fetchClaimsList(queryParams, signal),
    retry: false,
    staleTime: DEFAULTS.staleAfterMs,
  });

  const viewState = deriveViewState(
    queryResult.isPending,
    queryResult.isError,
    queryResult.data,
  );

  const hasActiveFilters =
    search.trim().length > 0 || statusFilter !== undefined || highImpactFilter;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter(undefined);
    setHighImpactFilter(false);
    setPage(1);
  };

  const totalPages = queryResult.data?.pagination.totalPages ?? 1;
  const canGoNext = page < totalPages;
  const canGoPrevious = page > 1;

  const goNext = () => {
    if (canGoNext) setPage(page + 1);
  };

  const goPrevious = () => {
    if (canGoPrevious) setPage(page - 1);
  };

  return {
    viewState,
    envelope: queryResult.data,
    error: queryResult.error ?? null,

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
    goNext,
    goPrevious,

    refetch: () => void queryResult.refetch(),
  };
}
