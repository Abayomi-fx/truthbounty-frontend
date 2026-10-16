import type { ReactNode } from 'react';

export type AsyncStatusValue =
  | 'idle'
  | 'loading'
  | 'empty'
  | 'stale'
  | 'error'
  | 'failed'
  | 'success';

export interface AsyncStatusProps {
  status: AsyncStatusValue;
  message: string;
  children?: ReactNode;
}

const alertStatuses = new Set<AsyncStatusValue>(['error', 'failed']);

/**
 * Shared live-region boundary for API and projection state.
 * Callers must provide a message that reflects their canonical data state.
 */
export function AsyncStatus({ status, message, children }: AsyncStatusProps) {
  if (status === 'idle') return null;

  const isAlert = alertStatuses.has(status);

  return (
    <div
      role={isAlert ? 'alert' : 'status'}
      aria-live={isAlert ? 'assertive' : 'polite'}
      aria-atomic="true"
      aria-busy={status === 'loading' || status === 'stale' ? 'true' : undefined}
    >
      {children ?? message}
    </div>
  );
}
