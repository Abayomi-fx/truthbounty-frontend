'use client';

/**
 * AuthoritySourceSummary — UI-FE-030
 *
 * Shows where each piece of role data is allowed to come from, per
 * FRONTEND_IMPLEMENTATION_MATRIX.md's canonical source classes table.
 * "Every production field must identify a source class in fixtures and
 * adapters" — this makes that identification visible to the operator
 * rather than just enforced internally.
 */
import type { GovernanceAuthoritySource, GovernanceSourceClass } from '@/app/types/governance-roles';

const SOURCE_LABEL: Record<GovernanceSourceClass, string> = {
  'pinned-contract': 'Pinned contract',
  'fresh-api-projection': 'Fresh API projection',
  'verified-release-manifest': 'Verified release manifest',
  'wallet-session-local': 'Wallet / session / local',
  'approved-content': 'Approved content',
};

export interface AuthoritySourceSummaryProps {
  sources: readonly GovernanceAuthoritySource[];
}

export function AuthoritySourceSummary({ sources }: AuthoritySourceSummaryProps) {
  return (
    <div
      data-testid="authority-source-summary"
      className="rounded-xl border border-border bg-card overflow-x-auto"
    >