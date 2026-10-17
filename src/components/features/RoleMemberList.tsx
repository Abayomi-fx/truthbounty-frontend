'use client';

/**
 * RoleMemberList — UI-FE-030
 *
 * Renders canonical role membership. Every row's grant timestamp and
 * audit/tx identifier must trace to a pinned-contract event — this
 * component never infers membership from a legacy role name.
 */
import { Users } from 'lucide-react';
import type { RoleMember } from '@/app/types/governance-roles';

export interface RoleMemberListProps {
  members: readonly RoleMember[];
  isLoading: boolean;
}

export function RoleMemberList({ members, isLoading }: RoleMemberListProps) {
  if (isLoading) {
    return (
      <div
        data-testid="role-member-list-loading"
        className="p-6 rounded-xl border border-border bg-card text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        Loading role membership…
      </div>
    );
  }

  if (members.length === 0) {