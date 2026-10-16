// src/app/queries/queryClient.ts
import { QueryClient } from '@tanstack/react-query';
import { readLowBandwidth } from '@/hooks/useNetworkStatus';
import { isRetryableStatus } from '@/app/lib/apiLifecycle';

const BASE_STALE_TIME = 1000 * 60 * 5; // 5 mins
const LOW_BANDWIDTH_STALE_TIME = 1000 * 60 * 15; // 15 mins when data-saver/slow
const GC_TIME = 1000 * 60 * 30; // 30 mins
const MAX_RETRY = 2;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

/** Skip futile retries while the browser reports offline. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isBrowser() && navigator.onLine === false) return false;
  // Never retry non-idempotent operations or context/stale-response failures.
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: string }).code;
    if (
      code === 'CONTEXT_CHANGED' ||
      code === 'CONTEXT_MISMATCH' ||
      code === 'CONTEXT_REQUIRED' ||
      code === 'STALE_RESPONSE' ||
      code === 'ABORTED' ||
      code === 'OFFLINE'
    ) {
      return false;
    }
  }
  return failureCount < MAX_RETRY;
}

/** Exponential backoff capped at 30s — kinder on constrained links. */
function retryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 30_000);
}

function resolveStaleTime(): number {
  return isBrowser() && readLowBandwidth() ? LOW_BANDWIDTH_STALE_TIME : BASE_STALE_TIME;
}

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
      // Mutations are non-idempotent by default and must never be retried automatically.
      retry: false,
      onError: (error) => console.error('Mutation error:', error),
      networkMode: 'olline',
    },
  },
});
