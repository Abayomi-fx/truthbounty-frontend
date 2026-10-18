// POSITIVE fixture — token-conformant component.
// All colours are expressed through semantic Tailwind token utilities.
// This file must produce ZERO token-drift violations.

import React from 'react';
import { cn } from '@/lib/utils';

export function ConformantBadge({ label }: { label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1',
        'bg-surface text-ink border-divider',
      )}
    >
      {label}
    </span>
  );
}

export function ConformantCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-testid="conformant-card"
      className="rounded-xl border border-divider bg-surface text-ink shadow-sm"
    >
      {children}
    </div>
  );
}

// Tabular-numeral amount using the tb-data utility (semantic).
export function ConformantAmount({ amount }: { amount: string }) {
  return (
    <span className="tb-data font-semibold tabular-nums text-ink">
      {amount}
    </span>
  );
}
