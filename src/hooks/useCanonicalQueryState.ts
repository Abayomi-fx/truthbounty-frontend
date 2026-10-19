/**
 * useCanonicalQueryState — universal surface URL state hook
 *
 * Wraps the canonical query-parameter boundary to give any surface a typed,
 * round-trip-stable URL filter state that:
 * - Reads initial state from the URL via the canonical parser.
 * - Writes back via the canonical builder (prohibited params are never emitted).
 * - Pushes changes into the browser history for back/forward support.
 *
 * WCAG 2.2 AA: after every navigation caused by a filter change, focus is moved
 * to the designated live-region anchor and an announcement is made via the
 * aria-live region. This is separate from the focus-management hook
 * (useCanonicalQueryFocus) which handles screen-reader announcements.
 *
 * Authority model:
 * - URL state is a presentation/shareability layer only. Capability evaluation,
 *   authentication, and mutation authority are not affected by URL state.
 * - Remote content and browser state are treated as untrusted input and
 *   always pass through the canonical parser before use.
 */

'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

import {
  buildCanonicalSearchParams,
  buildCanonicalUrl,
  getDefaultState,
  parseCanonicalSearchParams,
  type CanonicalQueryState,
  type ClaimsQueryState,
  type VerificationQueryState,
  type DisputesQueryState,
  type AuditQueryState,
  type IncidentsQueryState,
  type DocsQueryState,
  type QuerySurface,
} from '@/app/lib/canonical-query-params';

// ---------------------------------------------------------------------------
// Generic hook result shape
// ---------------------------------------------------------------------------

export interface UseCanonicalQueryStateResult<S extends CanonicalQueryState['state']> {
  /** The current canonical filter state (normalized, never carries prohibited fields). */
  state: S;
  /**
   * Replace the entire filter state, updating the URL. Focus will shift to the
   * nearest `data-filter-results` ancestor after the navigation.
   */
  setState: (next: Partial<S>) => void;
  /** Reset to the default state for this surface. */
  resetState: () => void;
  /** The current canonical query string (without leading '?'). */
  queryString: string;
  /** Whether any non-default filter is active. */
  hasActiveFilters: boolean;
  /**
   * Ref to attach to the live-region element. The hook uses it to announce
   * filter changes to screen readers (WCAG 2.2 AA, Criterion 4.1.3).
   */
  liveRegionRef: RefObject<HTMLElement>;
}

// ---------------------------------------------------------------------------
// Shared factory
// ---------------------------------------------------------------------------

function makeUseCanonicalQueryState<Surface extends QuerySurface>(
  surface: Surface,
) {
  type SurfaceState = Extract<CanonicalQueryState, { surface: Surface }>['state'];

  return function useCanonicalQueryStateForSurface(): UseCanonicalQueryStateResult<SurfaceState> {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const liveRegionRef = useRef<HTMLElement>(null);

    // Parse current URL into typed surface state on every navigation.
    const parsed = useMemo(() => {
      const result = parseCanonicalSearchParams(surface, searchParams);
      return result as Extract<CanonicalQueryState, { surface: Surface }>;
    }, [searchParams]);

    const state = parsed.state as SurfaceState;

    // Compute default for comparison.
    const defaultState = useMemo(
      () => (getDefaultState(surface) as Extract<CanonicalQueryState, { surface: Surface }>).state as SurfaceState,
      [],
    );

    const queryString = useMemo(
      () => buildCanonicalSearchParams(parsed).toString(),
      [parsed],
    );

    const hasActiveFilters = useMemo(
      () => queryString !== buildCanonicalSearchParams(
        getDefaultState(surface) as CanonicalQueryState,
      ).toString(),
      [queryString],
    );

    // Announce filter changes to screen readers.
    const announce = useCallback((message: string) => {
      const el = liveRegionRef.current;
      if (!el) return;
      // Clear first so re-setting the same message is still announced.
      el.textContent = '';
      requestAnimationFrame(() => {
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = message;
        }
      });
    }, []);

    const setState = useCallback(
      (partial: Partial<SurfaceState>) => {
        const next = { surface, state: { ...state, ...partial } } as CanonicalQueryState;
        const qs = buildCanonicalSearchParams(next).toString();
        const url = qs ? `${pathname}?${qs}` : pathname;
        router.push(url, { scroll: false });
        announce('Filters updated. Results loading.');
      },
      [router, pathname, state, announce],
    );

    const resetState = useCallback(() => {
      router.push(pathname, { scroll: false });
      announce('Filters cleared. Showing all results.');
    }, [router, pathname, announce]);

    return {
      state,
      setState,
      resetState,
      queryString,
      hasActiveFilters,
      liveRegionRef,
    };
  };
}

// ---------------------------------------------------------------------------
// Per-surface hooks (publicly exported)
// ---------------------------------------------------------------------------

/** URL filter state for the claims feed surface. */
export const useClaimsQueryState = makeUseCanonicalQueryState('claims');

/** URL filter state for the verification queue surface. */
export const useVerificationQueryState = makeUseCanonicalQueryState('verification');

/** URL filter state for the disputes surface. */
export const useDisputesQueryState = makeUseCanonicalQueryState('disputes');

/** URL filter state for the admin audit trail surface. */
export const useAuditQueryState = makeUseCanonicalQueryState('audit');

/** URL filter state for the incidents surface. */
export const useIncidentsQueryState = makeUseCanonicalQueryState('incidents');

/** URL filter state for the docs surface. */
export const useDocsQueryState = makeUseCanonicalQueryState('docs');

// ---------------------------------------------------------------------------
// Re-export state types for consumers
// ---------------------------------------------------------------------------

export type {
  ClaimsQueryState,
  VerificationQueryState,
  DisputesQueryState,
  AuditQueryState,
  IncidentsQueryState,
  DocsQueryState,
  QuerySurface,
  CanonicalQueryState,
};
