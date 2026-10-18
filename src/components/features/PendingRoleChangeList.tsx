'use client';

/**
 * PendingRoleChangeList — UI-FE-030
 *
 * Makes the timelocked lifecycle of a queued grant/revoke explicit, per
 * #600's acceptance criteria: "Timelocked lifecycle and pending changes
 * are explicit." A change with no `executableAfter` is still queued, not
 * yet scheduled — the two must never look the same.
 */
import { Clock, Hourglass } from 'lucide-react';
import type { PendingRoleChange } from '@/app/types/governance-roles';

const STATE_LABEL: Record<PendingRoleChange['state'], string> = {
  idle: 'Idle',
  validating: 'Validating',
  'awaiting-signature': 'Awaiting signature',
  rejected: 'Rejected',
  submitted: 'Submitted',
  replaced: 'Replaced',
  reverted: 'Reverted',
  confirmed: 'Confirmed — awaiting timelock',
  finalized: 'Finalized',
  'projection-lag': 'Projection lag',
  reorged: 'Reorganized',
  unavailable: 'Unavailable',
};

export interface PendingRoleChangeListProps {
  changes: readonly PendingRoleChange[];
  isLoading: boolean;