'use client';

/**
 * RoleAdministrationUnavailableState — UI-FE-030
 *
 * The explicit unavailable boundary this screen defaults to per
 * ADMIN_AUTHORITY_BOUNDARY.md's implementation approval rule: without an
 * issue linking the exact contract function, authorization check, audit
 * event and release-manifest field, mutation stays unavailable — and the
 * UI says so plainly rather than hiding the screen or faking data.
 */
import { ShieldAlert } from 'lucide-react';

export interface RoleAdministrationUnavailableStateProps {
  reason: string;
}

export function RoleAdministrationUnavailableState({ reason }: RoleAdministrationUnavailableStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="role-admin-unavailable"
      className="flex flex-col items-start gap-3 p-6 rounded-xl border border-border bg-card text-foreground"
    >
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
        <p className="text-sm font-semibold">Role administration is unavailable</p>
      </div>
      <p className="text-xs text-muted-foreground max-w-prose">{reason}</p>
      <p className="text-xs text-muted-foreground max-w-prose">