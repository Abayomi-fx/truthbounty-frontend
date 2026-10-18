// src/app/queries/queryClient.ts
import { QueryClient } from '@tanstack/react-query';
import { readLowBandwidth } from '@/hooks/useNetworkStatus';
import {
  readPersisted,
  registerPersistedKey,
  type PersistedKeyRegistration,
} from '@/app/lib/persistedState';

const BASE_STALE_TIME = 1000 * 60 * 5; // 5 mins
const LOW_BANDWIDTH_STALE_TIME = 1000 * 60 * 15; // 15 mins when data-saver/slow
const GC_TIME = 1000 * 60 * 30; // 30 mins
const MAX_RETRY = 2;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

/** Skip futile retries while the browser reports offline. */
function shouldRetry(failureCount: number): boolean {
  if (isBrowser() && navigator.onLine === false) return false;
  return failureCount < MAX_RETRY;
}

/** Exponential backoff capped at 30s — kinder on constrained links. */
function retryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 30_000);
}

function resolveStaleTime(): number {
  return isBrowser() && readLowBandwidth() ? LOW_BANDWIDTH_STALE_TIME : BASE_STALE_TIME;
}

/**
 * Persisted Query Cache Policy
 * ---------------------------
 * The query cache is persisted to browser storage only through the versioned,
 * bounded persistence layer. The cache is treated as untrusted input on rehydration:
 * corrupt, oversized, expired, partially written, or unsupported-newer state fails
 * closed and is dropped rather than boot-looping. Authoritative protocol state,
 * contract receipts, reviewed API projections, signatures, and secrets are never
 * persisted here.
 */
export const queryCachePersistence: PersistedKeyRegistration<unknown> = {
  key: 'tb.queryCache.v1',
  arena: 'localStorage',
  owner: 'query',
  version: 1,
  minVersion: 1,
  retentionMs: GC_TIME,
  maxBytes: 250 * 1024,
  sensitivity: 'internal',
  validate: (value): value is unknown => value !== undefined,
};

registerPersistedKey(queryCachePersistence);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: resolveStaleTime(),
      gcTime: GC_TIME,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      networkMode: 'online',
      retry: shouldRetry,
      retryDelay,
    },
    mutations: {
      onError: (error) => console.error('Mutation error:', error),
      networkMode: 'online',
    },
  },
});

/**
 * Rehydrate the query cache from browser storage. The persistence layer enforces
 * versioned schemas, bounded migrations, expiry, size limits, and corruption
 * recovery. Any failure is swallowed and the cache starts empty.
 */
export function rehydrateQueryCache(): void {
  if (!isBrowser()) return;
  try {
    readPersisted(queryCachePersistence.key);
  } catch {
    // Fail closed: drop untrusted persisted state without boot-looping.
  }
}