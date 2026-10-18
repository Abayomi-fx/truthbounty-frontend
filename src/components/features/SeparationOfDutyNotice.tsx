'use client';

/**
 * SeparationOfDutyNotice — UI-FE-030
 *
 * Read-only authority explanation, explicitly permitted even while the
 * release manifest is unverified (ROLE_AND_CAPABILITY_MATRIX.md's
 * canonical mapping rule: "the UI may render read-only authority
 * explanations"). Content here is principle-level — it explains *why*
 * separation of duty matters for this protocol's governance/guardian
 * contexts, not a specific conflict rule invented for roles that don't
 * exist yet.
 */
import { Info, AlertTriangle, Ban } from 'lucide-react';
import type { SeparationOfDutyWarning } from '@/app/types/governance-roles';

const SEVERITY_ICON = {
  info: Info,
  caution: AlertTriangle,
  blocking: Ban,
} as const;

const SEVERITY_STYLE = {
  info: 'border-border bg-card text-foreground',
  caution: 'border-amber-500/50 bg-amber-500/10 text-foreground',
  blocking: 'border-destructive/40 bg-destructive/10 text-foreground',
} as const;

export interface SeparationOfDutyNoticeProps {
  warnings: readonly SeparationOfDutyWarning[];
}
