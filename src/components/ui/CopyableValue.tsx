'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyPublicIdentifier, type PastedIdentifierKind } from '@/lib/clipboard';
import { cn } from '@/lib/utils';

export interface CopyableValueProps {
  /** Exact full public identifier sent to the clipboard. */
  value: string;
  kind: PastedIdentifierKind;
  /** Display text may be truncated; it is never used as the clipboard payload. */
  displayValue?: string;
  label: string;
  /** Optional label for callers that need to preserve an established accessible name. */
  accessibleLabel?: string;
  className?: string;
}

export function CopyableValue({ value, kind, displayValue = value, label, accessibleLabel, className }: CopyableValueProps) {
  const [status, setStatus] = useState('');

  const handleCopy = async () => {
    const result = await copyPublicIdentifier(value, kind);
    setStatus(
      result === 'copied'
        ? `${label} copied. Only public identifiers should be copied; never copy secrets.`
        : result === 'invalid'
          ? 'This value is not a valid public identifier and cannot be copied.'
        : result === 'denied'
          ? 'Clipboard access was denied. Select and copy the full value manually.'
          : 'Clipboard is unavailable. Select and copy the full value manually.',
    );
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('font-mono', className)}>{displayValue}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex shrink-0 items-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label={accessibleLabel ?? `Copy full ${label}: ${value}`}
        title={`Copy full ${label}`}
      >
        {status.startsWith(`${label} copied`)
          ? <Check size={12} aria-hidden="true" />
          : <Copy size={12} aria-hidden="true" />}
      </button>
      <span className="text-xs text-muted-foreground" role="status" aria-live="polite" aria-atomic="true">{status}</span>
    </span>
  );
}
