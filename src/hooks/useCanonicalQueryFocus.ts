/**
 * useCanonicalQueryFocus — WCAG 2.2 AA focus & announcement after navigation
 *
 * After the URL changes (back/forward, deep link, filter update, refresh),
 * this hook:
 *   1. Moves focus to the main content region or a designated focus target
 *      so screen-reader users land on the new content, not on the filter
 *      control that triggered the navigation.
 *   2. Updates an aria-live region with a human-readable announcement of the
 *      new filter state.
 *
 * This satisfies WCAG 2.2 AA Criteria:
 *   - 2.4.3 Focus Order (A): focus moves to logical content after navigation.
 *   - 3.2.2 On Input (A): changing a filter does not unexpectedly change context.
 *   - 4.1.3 Status Messages (AA): status changes are announced programmatically.
 *   - 2.4.7 Focus Visible (AA): the focus target has a visible focus indicator.
 *
 * Security: the announcement message is built only from canonical, allowlisted
 * state fields. It never includes wallet addresses, session data, or prohibited
 * parameters.
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

import {
  buildCanonicalSearchParams,
  getDefaultState,
  parseCanonicalSearchParams,
  type CanonicalQueryState,
  type QuerySurface,
} from '@/app/lib/canonical-query-params';

export interface UseCanonicalQueryFocusOptions {
  /**
   * Ref to the element that should receive focus after navigation.
   * Typically the main content heading or results container.
   */
  focusTargetRef: React.RefObject<HTMLElement>;
  /**
   * Ref to the aria-live region element. The hook will set its textContent
   * to announce the new state.
   */
  liveRegionRef: React.RefObject<HTMLElement>;
  /**
   * Optional label for the surface, used in the announcement message.
   * e.g. "Claims feed", "Verification queue".
   */
  surfaceLabel: string;
}

/**
 * Build a screen-reader-friendly announcement from canonical query state.
 * Only allowlisted fields appear; no wallet/session/secret data.
 */
function buildAnnouncement(
  surface: QuerySurface,
  state: CanonicalQueryState,
  surfaceLabel: string,
): string {
  const defaultState = getDefaultState(surface);
  const defaultQs = buildCanonicalSearchParams(defaultState).toString();
  const currentQs = buildCanonicalSearchParams(state).toString();

  if (currentQs === defaultQs || currentQs === '') {
    return `${surfaceLabel}: showing all results.`;
  }

  const parts: string[] = [];

  switch (state.surface) {
    case 'claims': {
      const s = state.state;
      if (s.search) parts.push(`search "${s.search}"`);
      if (s.status) parts.push(`status ${s.status}`);
      if (s.highImpact) parts.push('high impact only');
      if (s.page > 1) parts.push(`page ${s.page}`);
      break;
    }
    case 'verification': {
      const s = state.state;
      if (s.phase) parts.push(`phase ${s.phase}`);
      if (s.filter !== 'available') parts.push(`filter ${s.filter}`);
      if (s.page > 1) parts.push(`page ${s.page}`);
      break;
    }
    case 'disputes': {
      const s = state.state;
      if (s.claimId) parts.push(`claim ${s.claimId}`);
      if (s.status) parts.push(`status ${s.status}`);
      if (s.page > 1) parts.push(`page ${s.page}`);
      break;
    }
    case 'audit': {
      const s = state.state;
      if (s.action) parts.push(`action "${s.action}"`);
      if (s.authority) parts.push(`authority ${s.authority}`);
      if (s.page > 1) parts.push(`page ${s.page}`);
      break;
    }
    case 'incidents': {
      const s = state.state;
      if (s.severity) parts.push(`severity ${s.severity}`);
      if (s.status) parts.push(`status ${s.status}`);
      if (s.page > 1) parts.push(`page ${s.page}`);
      break;
    }
    case 'docs': {
      const s = state.state;
      if (s.search) parts.push(`search "${s.search}"`);
      if (s.category) parts.push(`category ${s.category}`);
      if (s.page > 1) parts.push(`page ${s.page}`);
      break;
    }
  }

  if (parts.length === 0) {
    return `${surfaceLabel}: showing all results.`;
  }
  return `${surfaceLabel}: filtered by ${parts.join(', ')}.`;
}

/**
 * Hook that manages focus and aria-live announcements after URL navigation
 * for a canonical query surface.
 *
 * Usage:
 * ```tsx
 * const focusRef = useRef<HTMLElement>(null);
 * const liveRef = useRef<HTMLElement>(null);
 * useCanonicalQueryFocus('claims', { focusTargetRef: focusRef, liveRegionRef: liveRef, surfaceLabel: 'Claims feed' });
 * return (
 *   <>
 *     <div ref={liveRef} aria-live="polite" aria-atomic="true" className="sr-only" />
 *     <main ref={focusRef} tabIndex={-1}>...</main>
 *   </>
 * );
 * ```
 */
export function useCanonicalQueryFocus(
  surface: QuerySurface,
  options: UseCanonicalQueryFocusOptions,
): void {
  const { focusTargetRef, liveRegionRef, surfaceLabel } = options;
  const searchParams = useSearchParams();
  const isFirstRender = useRef(true);
  const prevQueryString = useRef<string | null>(null);

  const handleNavigation = useCallback(() => {
    const current = parseCanonicalSearchParams(surface, searchParams);
    const currentQs = buildCanonicalSearchParams(current).toString();

    // Skip the very first render — we don't want to steal focus on initial load
    // unless the URL already has filters (deep link).
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevQueryString.current = currentQs;
      // On a deep-linked URL with active filters, still announce but don't move focus.
      if (currentQs && currentQs !== '') {
        const message = buildAnnouncement(surface, current, surfaceLabel);
        const liveEl = liveRegionRef.current;
        if (liveEl) {
          liveEl.textContent = '';
          requestAnimationFrame(() => {
            if (liveRegionRef.current) {
              liveRegionRef.current.textContent = message;
            }
          });
        }
      }
      return;
    }

    // Only act when the query string actually changed.
    if (currentQs === prevQueryString.current) return;
    prevQueryString.current = currentQs;

    // Move focus to the content region.
    const focusEl = focusTargetRef.current;
    if (focusEl) {
      // Prevent the browser from scrolling to the focused element unexpectedly.
      focusEl.focus({ preventScroll: true });
    }

    // Announce the new state.
    const message = buildAnnouncement(surface, current, surfaceLabel);
    const liveEl = liveRegionRef.current;
    if (liveEl) {
      liveEl.textContent = '';
      requestAnimationFrame(() => {
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = message;
        }
      });
    }
  }, [surface, searchParams, focusTargetRef, liveRegionRef, surfaceLabel]);

  useEffect(() => {
    handleNavigation();
  }, [handleNavigation]);
}
