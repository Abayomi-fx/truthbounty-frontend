import {
  formatLastSynced,
  isConstrainedEffectiveType,
  isConstrainedNetwork,
  isReducedDataActive,
  parseStoredReducedDataMode,
  readStoredReducedDataMode,
  resolveAdaptivePollIntervalMs,
  resolveReduceMotion,
  resolveReducedDataSource,
  shouldDeferRichMedia,
  writeStoredReducedDataMode,
  type StorageLike,
} from '../reduced-data';
import { REDUCED_DATA_POLICY, REDUCED_DATA_STORAGE_KEY } from '@/config/reduced-data';

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

describe('reduced-data resolution (UI-FE-082)', () => {
  describe('resolveReducedDataSource', () => {
    it('honours an explicit "on" override regardless of browser hints', () => {
      expect(
        resolveReducedDataSource({ mode: 'on', saveData: false, effectiveType: '4g' }),
      ).toBe('forced-on');
    });

    it('honours an explicit "off" override even on a constrained network', () => {
      expect(
        resolveReducedDataSource({ mode: 'off', saveData: true, effectiveType: '2g' }),
      ).toBe('forced-off');
    });

    it('follows browser save-data in auto mode', () => {
      expect(
        resolveReducedDataSource({ mode: 'auto', saveData: true, effectiveType: '4g' }),
      ).toBe('browser-save-data');
    });

    it('follows a slow effectiveType in auto mode', () => {
      expect(
        resolveReducedDataSource({ mode: 'auto', saveData: false, effectiveType: '3g' }),
      ).toBe('slow-connection');
    });

    it('reports standard when nothing is constrained', () => {
      expect(
        resolveReducedDataSource({ mode: 'auto', saveData: false, effectiveType: '4g' }),
      ).toBe('standard');
    });
  });

  it('isReducedDataActive is true for every constrained source and false for opt-out', () => {
    expect(isReducedDataActive('forced-on')).toBe(true);
    expect(isReducedDataActive('browser-save-data')).toBe(true);
    expect(isReducedDataActive('slow-connection')).toBe(true);
    expect(isReducedDataActive('forced-off')).toBe(false);
    expect(isReducedDataActive('standard')).toBe(false);
  });

  describe('connection classification', () => {
    it('treats slow-2g/2g/3g as constrained and 4g/5g as unconstrained', () => {
      expect(isConstrainedEffectiveType('slow-2g')).toBe(true);
      expect(isConstrainedEffectiveType('2g')).toBe(true);
      expect(isConstrainedEffectiveType('3g')).toBe(true);
      expect(isConstrainedEffectiveType('4g')).toBe(false);
      expect(isConstrainedEffectiveType('5g')).toBe(false);
      expect(isConstrainedEffectiveType(undefined)).toBe(false);
    });

    it('isConstrainedNetwork accounts for save-data or slow type', () => {
      expect(isConstrainedNetwork(true, '4g')).toBe(true);
      expect(isConstrainedNetwork(false, '2g')).toBe(true);
      expect(isConstrainedNetwork(false, '4g')).toBe(false);
    });
  });

  describe('resolveAdaptivePollIntervalMs', () => {
    const base = 30_000;

    it('returns the caller interval unchanged for critical polling', () => {
      expect(
        resolveAdaptivePollIntervalMs(base, { critical: true, isReducedData: true }),
      ).toBe(base);
    });

    it('returns the caller interval unchanged when reduced-data is inactive', () => {
      expect(resolveAdaptivePollIntervalMs(base, { isReducedData: false })).toBe(base);
    });

    it('stretches non-critical polling while reduced-data is active', () => {
      expect(resolveAdaptivePollIntervalMs(base, { isReducedData: true })).toBe(
        base * REDUCED_DATA_POLICY.pollMultiplier,
      );
    });

    it('caps stretched intervals at the policy ceiling', () => {
      const huge = REDUCED_DATA_POLICY.maxPollIntervalMs * 10;
      expect(resolveAdaptivePollIntervalMs(huge, { isReducedData: true })).toBe(
        REDUCED_DATA_POLICY.maxPollIntervalMs,
      );
    });

    it('leaves already-cheap intervals untouched', () => {
      expect(resolveAdaptivePollIntervalMs(1_000, { isReducedData: true })).toBe(1_000);
    });

    it('falls back to manual refresh only when requested', () => {
      expect(
        resolveAdaptivePollIntervalMs(base, {
          isReducedData: true,
          manualOnlyWhenReduced: true,
        }),
      ).toBe(false);
      // manual fallback must NOT apply to critical polling
      expect(
        resolveAdaptivePollIntervalMs(base, {
          critical: true,
          isReducedData: true,
          manualOnlyWhenReduced: true,
        }),
      ).toBe(base);
    });

    it('preserves an explicit "no polling" signal', () => {
      expect(resolveAdaptivePollIntervalMs(false, { isReducedData: true })).toBe(false);
    });
  });

  describe('storage persistence (fail closed)', () => {
    it('round-trips a forced mode', () => {
      const storage = makeStorage();
      writeStoredReducedDataMode('on', storage);
      expect(storage.data[REDUCED_DATA_STORAGE_KEY]).toBe('on');
      expect(readStoredReducedDataMode(storage)).toBe('on');
    });

    it('clears storage for auto mode and reads back auto', () => {
      const storage = makeStorage({ [REDUCED_DATA_STORAGE_KEY]: 'on' });
      writeStoredReducedDataMode('auto', storage);
      expect(storage.data[REDUCED_DATA_STORAGE_KEY]).toBeUndefined();
      expect(readStoredReducedDataMode(storage)).toBe('auto');
    });

    it('fails closed to auto for unknown/corrupted values', () => {
      expect(parseStoredReducedDataMode('bogus')).toBe('auto');
      expect(parseStoredReducedDataMode(null)).toBe('auto');
      expect(readStoredReducedDataMode(makeStorage({ [REDUCED_DATA_STORAGE_KEY]: '{}' }))).toBe('auto');
    });

    it('never throws when storage access fails', () => {
      const throwing: StorageLike = {
        getItem: () => {
          throw new Error('denied');
        },
        setItem: () => {
          throw new Error('denied');
        },
      };
      expect(readStoredReducedDataMode(throwing)).toBe('auto');
      expect(() => writeStoredReducedDataMode('on', throwing)).not.toThrow();
    });
  });

  describe('rich media & motion', () => {
    it('defers rich media only while reduced-data is active', () => {
      expect(shouldDeferRichMedia(true)).toBe(true);
      expect(shouldDeferRichMedia(false)).toBe(false);
    });

    it('reduces motion when the OS asks or data saving is active', () => {
      expect(resolveReduceMotion({ osPrefersReducedMotion: true, reducedDataActive: false })).toBe(true);
      expect(resolveReduceMotion({ osPrefersReducedMotion: false, reducedDataActive: true })).toBe(true);
      expect(resolveReduceMotion({ osPrefersReducedMotion: false, reducedDataActive: false })).toBe(false);
    });
  });

  describe('formatLastSynced', () => {
    const now = Date.parse('2026-06-01T12:00:00.000Z');

    it('returns "never" when no timestamp exists', () => {
      expect(formatLastSynced(null, now)).toBe('never');
      expect(formatLastSynced(undefined, now)).toBe('never');
    });

    it('formats recent, minute, hour and day deltas', () => {
      expect(formatLastSynced(now - 1_000, now)).toBe('just now');
      expect(formatLastSynced(now - 30_000, now)).toBe('30s ago');
      expect(formatLastSynced(now - 5 * 60_000, now)).toBe('5m ago');
      expect(formatLastSynced(now - 3 * 3_600_000, now)).toBe('3h ago');
      expect(formatLastSynced(now - 2 * 86_400_000, now)).toBe('2d ago');
    });

    it('accepts ISO strings and returns "unknown" for garbage', () => {
      expect(formatLastSynced('2026-06-01T11:59:00.000Z', now)).toBe('1m ago');
      expect(formatLastSynced('not-a-date', now)).toBe('unknown');
    });
  });
});
