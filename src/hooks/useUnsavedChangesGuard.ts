/**
 * UI-FE-084 — useUnsavedChangesGuard.
 *
 * Blocks the three navigation paths that can silently destroy nontrivial
 * form input while the guard is armed:
 *  1. Browser refresh / tab close / browser back-forward that unload the
 *     document (`beforeunload` — native prompt, cannot be customised).
 *  2. Internal link navigation (capture-phase anchor interception) — the
 *     caller-supplied `confirm` promise decides whether to proceed.
 *  3. SPA history traversal (`popstate`) — the traversal is undone and the
 *     `confirm` promise decides whether to actually leave.
 *
 * The guard is passive: it only acts while `when` is true. Callers release
 * it by clearing `when` (typically after verified persistence or an
 * explicit discard) — the guard itself never clears dirty state.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export type GuardedNavigationKind = 'beforeunload' | 'internal-link' | 'history';

export interface UseUnsavedChangesGuardOptions {
  /** Arm the guard while true. */
  when: boolean;
  /** Ask the user whether leaving is allowed. Resolve true to allow. */
  confirm: () => Promise<boolean>;
  /** Custom navigator; defaults to the App Router `push`. */
  navigate?: (href: string) => void;
  /** Invoked whenever a navigation attempt was blocked (telemetry/announcements). */
  onBlocked?: (kind: GuardedNavigationKind) => void;
}

export interface UseUnsavedChangesGuardResult {
  /** True while the guard is currently armed. */
  active: boolean;
  /** Programmatic entry point for wrapped navigations (router.push wrappers). */
  confirmNavigation: (href: string) => Promise<boolean>;
}

function isModifiedClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function shouldInterceptAnchor(anchor: HTMLAnchorElement, event: MouseEvent): boolean {
  if (isModifiedClick(event)) return false;
  if (anchor.target === '_blank' || anchor.hasAttribute('download') || anchor.rel.includes('external')) {
    return false;
  }
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false;
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

export function useUnsavedChangesGuard(
  options: UseUnsavedChangesGuardOptions,
): UseUnsavedChangesGuardResult {
  const { when, confirm, navigate, onBlocked } = options;
  const router = useRouter();

  const whenRef = useRef(when);
  whenRef.current = when;
  const confirmRef = useRef(confirm);
  confirmRef.current = confirm;
  const onBlockedRef = useRef(onBlocked);
  onBlockedRef.current = onBlocked;

  const navigateRef = useRef((href: string) => {
    if (navigate) navigate(href);
    else router.push(href);
  });
  navigateRef.current = (href: string) => {
    if (navigate) navigate(href);
    else router.push(href);
  };

  // 1. Browser refresh / unload protection.
  useEffect(() => {
    if (!when) return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy browsers require returnValue to be set to show the prompt.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [when]);

  // 2 + 3. Internal anchor interception and SPA history protection.
  useEffect(() => {
    if (!when) return undefined;

    const onClick = (event: MouseEvent) => {
      if (!whenRef.current) return;
      const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
      const anchor = path.find(
        (node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement,
      );
      if (!anchor || !shouldInterceptAnchor(anchor, event)) return;

      event.preventDefault();
      event.stopPropagation();
      onBlockedRef.current?.('internal-link');

      const href = anchor.href;
      void confirmRef.current().then((allowed) => {
        if (allowed) navigateRef.current(href);
      });
    };

    // Undo an in-flight SPA traversal immediately, then ask. Only when the
    // user confirms is the traversal replayed (with the guard suppressed so
    // the replayed popstate is not re-prompted).
    let suppressNextPopstate = false;
    const onPopState = () => {
      if (suppressNextPopstate) {
        suppressNextPopstate = false;
        return;
      }
      if (!whenRef.current) return;

      onBlockedRef.current?.('history');
      // Reverse the traversal: we were at X, the user moved to Y; go back to X.
      suppressNextPopstate = true;
      window.history.go(1);

      void confirmRef.current().then((allowed) => {
        if (allowed) {
          suppressNextPopstate = true;
          window.history.back();
        }
      });
    };

    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPopState);
    };
  }, [when]);

  const confirmNavigation = (href: string): Promise<boolean> =>
    confirmRef.current().then((allowed) => {
      if (allowed) navigateRef.current(href);
      return allowed;
    });

  return { active: when, confirmNavigation };
}
