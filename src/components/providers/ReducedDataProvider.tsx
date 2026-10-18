'use client';

/**
 * ReducedDataProvider — global reduced-data & constrained-network layer
 * (UI-FE-082).
 *
 * Responsibilities:
 *  - Observe `navigator.connection.saveData` / `effectiveType` and online state
 *    through `useNetworkStatus`.
 *  - Observe `prefers-reduced-motion` through `usePrefersReducedMotion`.
 *  - Own a persisted, user-controllable override (`auto` | `on` | `off`).
 *  - Expose deterministic helpers (`getPollInterval`, `shouldDeferRichMedia`,
 *    `reduceMotion`) that consumers use to throttle non-essential work.
 *
 * Integrity guarantee: this provider only *narrows* optional read frequency and
 * asset loading. It never participates in authorization, cryptographic
 * verification, receipt validation, or contract integrity checks — those are
 * marked `critical` and returned unchanged by `getPollInterval`.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePrefersReducedMotion } from '@/hooks/useReducedMotion';
import {
  isConstrainedNetwork,
  isReducedDataActive,
  readStoredReducedDataMode,
  resolveAdaptivePollIntervalMs,
  resolveReduceMotion,
  resolveReducedDataSource,
  shouldDeferRichMedia as shouldDeferRichMediaFor,
  writeStoredReducedDataMode,
  type AdaptivePollIntervalOptions,
  type ReducedDataSource,
  type StorageLike,
} from '@/lib/reduced-data';
import type { ReducedDataMode } from '@/config/reduced-data';

export interface ReducedDataContextValue {
  /** Raw user preference. */
  readonly mode: ReducedDataMode;
  /** Why the layer is currently active/inactive. */
  readonly source: ReducedDataSource;
  /** True when the reduced-data policy should be applied. */
  readonly isReducedData: boolean;
  /** True when the physical connection is constrained (informational). */
  readonly isConstrainedNetwork: boolean;
  /** Browser-reported data-saver hint. */
  readonly browserSaveData: boolean;
  /** Browser-reported effective connection type, if any. */
  readonly effectiveType: string | null;
  /** Browser connectivity. */
  readonly isOnline: boolean;
  /** OS reduced-motion preference. */
  readonly osPrefersReducedMotion: boolean;
  /** Effective reduced-motion signal (OS preference OR reduced data). */
  readonly reduceMotion: boolean;
  /** True when heavy previews/images should be replaced by click-to-load placeholders. */
  readonly shouldDeferRichMedia: boolean;
  /** Set an explicit user preference (persisted). */
  setMode: (mode: ReducedDataMode) => void;
  /** Convenience: force `off` when active, otherwise force `on`. */
  toggle: () => void;
  /**
   * Resolve a polling interval. Protocol/security-critical reads MUST pass
   * `critical: true` and are returned unchanged.
   */
  getPollInterval: (
    baseIntervalMs: number | false,
    options?: Omit<AdaptivePollIntervalOptions, 'isReducedData'>,
  ) => number | false;
}

export const ReducedDataContext = createContext<ReducedDataContextValue | null>(null);

export interface ReducedDataProviderProps {
  children: ReactNode;
  /** Seed the preference (useful for tests / storybook). */
  initialMode?: ReducedDataMode;
  /** Inject a storage surface; defaults to `window.localStorage`. */
  storage?: StorageLike | null;
  /** Inject browser network hints instead of reading `navigator`. */
  network?: {
    saveData?: boolean;
    effectiveType?: string | null;
    isOnline?: boolean;
  };
  /** Inject the OS reduced-motion preference. */
  osPrefersReducedMotion?: boolean;
}

export function ReducedDataProvider({
  children,
  initialMode,
  storage,
  network,
  osPrefersReducedMotion,
}: ReducedDataProviderProps) {
  const liveNetwork = useNetworkStatus();
  const liveReducedMotion = usePrefersReducedMotion();

  const saveData = network?.saveData ?? liveNetwork.saveData;
  const effectiveType = network?.effectiveType ?? liveNetwork.effectiveType;
  const isOnline = network?.isOnline ?? liveNetwork.isOnline;
  const osReducedMotion = osPrefersReducedMotion ?? liveReducedMotion;

  const [mode, setModeState] = useState<ReducedDataMode>(initialMode ?? 'auto');

  const resolveStorage = useCallback((): StorageLike | null => {
    if (storage !== undefined) return storage;
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }, [storage]);

  // Hydrate the persisted preference after mount to avoid SSR hydration
  // mismatch (server renders `auto`, client may render `on`/`off`).
  useEffect(() => {
    if (initialMode !== undefined) return;
    const stored = readStoredReducedDataMode(resolveStorage());
    setModeState(stored);
  }, [initialMode, resolveStorage]);

  const setMode = useCallback(
    (next: ReducedDataMode) => {
      setModeState(next);
      writeStoredReducedDataMode(next, resolveStorage());
    },
    [resolveStorage],
  );

  const source = useMemo(
    () =>
      resolveReducedDataSource({
        mode,
        saveData,
        effectiveType,
      }),
    [mode, saveData, effectiveType],
  );

  const reducedDataActive = isReducedDataActive(source);
  const constrained = isConstrainedNetwork(saveData, effectiveType);

  const toggle = useCallback(() => {
    setMode(reducedDataActive ? 'off' : 'on');
  }, [reducedDataActive, setMode]);

  const getPollInterval = useCallback(
    (
      baseIntervalMs: number | false,
      options: Omit<AdaptivePollIntervalOptions, 'isReducedData'> = {},
    ) => resolveAdaptivePollIntervalMs(baseIntervalMs, { ...options, isReducedData: reducedDataActive }),
    [reducedDataActive],
  );

  const value = useMemo<ReducedDataContextValue>(
    () => ({
      mode,
      source,
      isReducedData: reducedDataActive,
      isConstrainedNetwork: constrained,
      browserSaveData: Boolean(saveData),
      effectiveType: effectiveType ?? null,
      isOnline,
      osPrefersReducedMotion: osReducedMotion,
      reduceMotion: resolveReduceMotion({
        osPrefersReducedMotion: osReducedMotion,
        reducedDataActive,
      }),
      shouldDeferRichMedia: shouldDeferRichMediaFor(reducedDataActive),
      setMode,
      toggle,
      getPollInterval,
    }),
    [
      mode,
      source,
      reducedDataActive,
      constrained,
      saveData,
      effectiveType,
      isOnline,
      osReducedMotion,
      setMode,
      toggle,
      getPollInterval,
    ],
  );

  return <ReducedDataContext.Provider value={value}>{children}</ReducedDataContext.Provider>;
}

export default ReducedDataProvider;

/** Direct context access. Prefer `useReducedData` from `@/hooks/useReducedData`. */
export function useReducedDataContext(): ReducedDataContextValue | null {
  return useContext(ReducedDataContext);
}
