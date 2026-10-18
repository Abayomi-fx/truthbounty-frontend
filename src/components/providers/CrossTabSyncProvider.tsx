'use client';

/**
 * UI-FE-059 — App-level cross-tab context boundary.
 *
 * Wraps `useCrossTabSync` and renders an explicit, accessible recovery notice
 * whenever a sibling tab revoked this tab's wallet/session context. The notice
 * is non-destructive: local work is preserved and the user is asked to
 * reconcile before mutating again.
 */

import React, { createContext, useContext, type ReactNode } from 'react';

import {
  useCrossTabSync,
  type UseCrossTabSyncOptions,
  type UseCrossTabSyncReturn,
} from '@/hooks/useCrossTabSync';

const CrossTabSyncContext = createContext<UseCrossTabSyncReturn | null>(null);

/** Access the cross-tab context (or null outside the provider). */
export function useCrossTabSyncContext(): UseCrossTabSyncReturn | null {
  return useContext(CrossTabSyncContext);
}

export interface CrossTabSyncProviderProps {
  children: ReactNode;
  /** Forwarded to `useCrossTabSync` (channel, overrides, callbacks). */
  options?: UseCrossTabSyncOptions;
}

export function CrossTabSyncProvider({
  children,
  options,
}: CrossTabSyncProviderProps) {
  const sync = useCrossTabSync(options);

  return (
    <CrossTabSyncContext.Provider value={sync}>
      {sync.requiresRecovery && sync.recoveryMessage ? (
        <CrossTabRecoveryBanner
          message={sync.recoveryMessage}
          onAcknowledge={sync.acknowledge}
        />
      ) : null}
      {children}
    </CrossTabSyncContext.Provider>
  );
}

interface CrossTabRecoveryBannerProps {
  message: string;
  onAcknowledge: () => void;
}

function CrossTabRecoveryBanner({
  message,
  onAcknowledge,
}: CrossTabRecoveryBannerProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl">{message}</p>
        <button
          type="button"
          onClick={onAcknowledge}
          className="shrink-0 self-start rounded-md border border-border bg-background px-3 py-1.5 font-medium sm:self-auto"
        >
          I understand
        </button>
      </div>
    </div>
  );
}

export default CrossTabSyncProvider;
