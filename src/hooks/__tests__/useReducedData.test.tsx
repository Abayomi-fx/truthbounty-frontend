import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { ReducedDataProvider } from '@/components/providers/ReducedDataProvider';
import { useAdaptivePolling, useReducedData } from '../useReducedData';
import { REDUCED_DATA_STORAGE_KEY, type ReducedDataMode } from '@/config/reduced-data';
import type { StorageLike } from '@/lib/reduced-data';

function makeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

function wrapper(props: {
  initialMode?: ReducedDataMode;
  network?: { saveData?: boolean; effectiveType?: string | null; isOnline?: boolean };
  storage?: StorageLike | null;
  osPrefersReducedMotion?: boolean;
}) {
  return ({ children }: { children: React.ReactNode }) => (
    <ReducedDataProvider {...props}>{children}</ReducedDataProvider>
  );
}

describe('useReducedData (UI-FE-082)', () => {
  it('falls back to a conservative standard state without a provider', () => {
    const { result } = renderHook(() => useReducedData());
    expect(result.current.isReducedData).toBe(false);
    expect(result.current.shouldDeferRichMedia).toBe(false);
    expect(result.current.getPollInterval(30_000)).toBe(30_000);
  });

  it('activates in auto mode when the browser reports save-data', () => {
    const { result } = renderHook(() => useReducedData(), {
      wrapper: wrapper({ network: { saveData: true, effectiveType: '4g' } }),
    });
    expect(result.current.source).toBe('browser-save-data');
    expect(result.current.isReducedData).toBe(true);
    expect(result.current.shouldDeferRichMedia).toBe(true);
  });

  it('activates in auto mode on a slow effective connection', () => {
    const { result } = renderHook(() => useReducedData(), {
      wrapper: wrapper({ network: { saveData: false, effectiveType: '2g' } }),
    });
    expect(result.current.source).toBe('slow-connection');
    expect(result.current.isConstrainedNetwork).toBe(true);
    expect(result.current.isReducedData).toBe(true);
  });

  it('honours a forced-on override on an otherwise fast connection', () => {
    const { result } = renderHook(() => useReducedData(), {
      wrapper: wrapper({ initialMode: 'on', network: { saveData: false, effectiveType: '4g' } }),
    });
    expect(result.current.source).toBe('forced-on');
    expect(result.current.isReducedData).toBe(true);
  });

  it('honours a forced-off override even on a constrained connection', () => {
    const { result } = renderHook(() => useReducedData(), {
      wrapper: wrapper({ initialMode: 'off', network: { saveData: true, effectiveType: '2g' } }),
    });
    expect(result.current.source).toBe('forced-off');
    expect(result.current.isReducedData).toBe(false);
    expect(result.current.shouldDeferRichMedia).toBe(false);
    // physical constraint is still reported for messaging
    expect(result.current.isConstrainedNetwork).toBe(true);
  });

  it('toggles between forced on and off, persisting the choice', () => {
    const storage = makeStorage();
    const { result } = renderHook(() => useReducedData(), {
      wrapper: wrapper({ storage, network: { saveData: false, effectiveType: '4g' } }),
    });

    expect(result.current.mode).toBe('auto');

    act(() => result.current.toggle());
    expect(result.current.mode).toBe('on');
    expect(storage.data[REDUCED_DATA_STORAGE_KEY]).toBe('on');

    act(() => result.current.toggle());
    expect(result.current.mode).toBe('off');
    expect(storage.data[REDUCED_DATA_STORAGE_KEY]).toBe('off');
  });

  it('hydrates a persisted preference after mount', () => {
    const storage = makeStorage({ [REDUCED_DATA_STORAGE_KEY]: 'on' });
    const { result } = renderHook(() => useReducedData(), {
      wrapper: wrapper({ storage, network: { saveData: false, effectiveType: '4g' } }),
    });
    expect(result.current.mode).toBe('on');
    expect(result.current.isReducedData).toBe(true);
  });

  it('reduces motion when the OS preference is set', () => {
    const { result } = renderHook(() => useReducedData(), {
      wrapper: wrapper({ osPrefersReducedMotion: true }),
    });
    expect(result.current.osPrefersReducedMotion).toBe(true);
    expect(result.current.reduceMotion).toBe(true);
  });

  describe('getPollInterval integrity invariants', () => {
    it('never stretches protocol-critical polling under data saver', () => {
      const { result } = renderHook(() => useReducedData(), {
        wrapper: wrapper({ initialMode: 'on' }),
      });
      expect(result.current.getPollInterval(15_000, { critical: true })).toBe(15_000);
    });

    it('stretches non-critical polling under data saver', () => {
      const { result } = renderHook(() => useReducedData(), {
        wrapper: wrapper({ initialMode: 'on' }),
      });
      expect(result.current.getPollInterval(30_000, { critical: false })).toBe(120_000);
    });
  });
});

describe('useAdaptivePolling (UI-FE-082)', () => {
  it('reports non-critical polling as deferred while reduced-data is active', () => {
    const { result } = renderHook(
      () => useAdaptivePolling({ baseIntervalMs: 30_000, critical: false }),
      { wrapper: wrapper({ initialMode: 'on' }) },
    );
    expect(result.current.pollInterval).toBe(120_000);
    expect(result.current.isDeferred).toBe(true);
    expect(result.current.criticality).toBe('non-critical');
  });

  it('never reports critical polling as deferred', () => {
    const { result } = renderHook(
      () => useAdaptivePolling({ baseIntervalMs: 15_000, critical: true }),
      { wrapper: wrapper({ initialMode: 'on' }) },
    );
    expect(result.current.pollInterval).toBe(15_000);
    expect(result.current.isDeferred).toBe(false);
    expect(result.current.criticality).toBe('critical');
  });

  it('disables polling when the caller disables it', () => {
    const { result } = renderHook(
      () => useAdaptivePolling({ baseIntervalMs: 30_000, enabled: false }),
      { wrapper: wrapper({ initialMode: 'on' }) },
    );
    expect(result.current.pollInterval).toBe(false);
    expect(result.current.isDeferred).toBe(false);
  });
});
