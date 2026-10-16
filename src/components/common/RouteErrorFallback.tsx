'use client';

import { toSafeErrorMessage } from '@/lib/sanitize-error';
import {
  SystemState,
  type SystemStateAction,
} from '@/components/common/SystemState';

export interface RouteErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Route scope label, e.g. "dashboard" or "claim detail". */
  scope: string;
  /** Show pending-transaction preservation notice (default true). */
  preserveNotice?: boolean;
  /** Optional stable identifier to preserve across retries (e.g. route id). */
  recoverableId?: string;
  /** Optional diagnostic reference code to surface to users. */
  diagnosticId?: string;
}

/**
 * Shared fallback for Next.js `error.tsx` route boundaries.
 * Uses the canonical `SystemState` family so error presentation is
 * consistent with the other eight system states. Uses canonical `reset()*` for safe retry and never renders stacks.
 */
export function RouteErrorFallback({
  error,
  reset,
  scope,
  preserveNotice = true,
  recoverableId,
  diagnosticId,
}: RouteErrorFallbackProps) {
  const message = toSafeErrorMessage(error);

  const actions: SystemStateAction[] = [
    {
      label: 'Try again',
      onClick: reset,
      variant: 'primary',
      autoFocus: true,
    },
    {
      label: 'Go back',
      onClick: () => window.history.back(),
      variant: 'secondary',
    },
  ];

  return (
    <SystemState
      state="error"
      scope={scope}
      title="This section couldn't load"
      description={message}
      preserveNotice={preserveNotice}
      recoverableId={recoverableId}
      diagnosticId={diagnosticId}
      actions={actions}
    />
  );
}
