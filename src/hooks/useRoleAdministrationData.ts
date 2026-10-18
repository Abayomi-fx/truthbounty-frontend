'use client';

/**
 * useRoleAdministrationData — UI-FE-030
 *
 * TODO(before merge): `isAuthorized` below fails closed (always false) by
 * design. It must be wired to this codebase's real wallet/session/release
 * check — the same mechanism `useAdminDashboardData` uses for
 * `isAuthorized`/`canonicalAdminAddress` — before this hook is used for
 * anything beyond Storybook/tests. It was deliberately left unwired rather
 * than guessed, since ADMIN_AUTHORITY_BOUNDARY.md prohibits "using frontend
 * role checks as authorization" built on assumptions, and getting this
 * wrong is worse than leaving it visibly unfinished.
 *
 * Everything else below is accurate as of this issue's dependencies:
 * `manifestUnavailable` is unconditionally true because STAB-FE-005 (#560)
 * has not yet published a verified release manifest, so there is no
 * canonical source for role data (see ROLE_AND_CAPABILITY_MATRIX.md's
 * canonical mapping rule). This is not an error state — it is correct,
 * and the UI must keep rendering it until that dependency lands.
 */
import { useCallback, useMemo } from 'react';
import type {
  GovernanceAuthoritySource,
  GovernanceSurfaceState,
  GrantRevokeDraft,
  RoleAdministrationData,
} from '@/app/types/governance-roles';

const MANIFEST_UNAVAILABLE_REASON =
  'No verified release manifest is available yet. Role membership, pending changes, and grant/revoke submission stay unavailable until one is published (see STAB-FE-005).';

const AUTHORITY_SOURCES: readonly GovernanceAuthoritySource[] = [
  { field: 'Role membership', source: 'pinned-contract', unavailableReason: MANIFEST_UNAVAILABLE_REASON },
  { field: 'Pending change lifecycle', source: 'pinned-contract', unavailableReason: MANIFEST_UNAVAILABLE_REASON },
  { field: 'Timelock readiness', source: 'pinned-contract', unavailableReason: MANIFEST_UNAVAILABLE_REASON },
  {
    field: 'Role/capability identifiers',
    source: 'verified-release-manifest',
    unavailableReason: MANIFEST_UNAVAILABLE_REASON,
  },
  { field: 'Connected account', source: 'wallet-session-local', unavailableReason: null },
];

export interface UseRoleAdministrationDataReturn extends RoleAdministrationData {}

export function useRoleAdministrationData(): UseRoleAdministrationDataReturn {
  // Fails closed until wired — see the TODO above.
  const isAuthorized = false;
  const unauthorizedReason =
    'Governance operator authorization has not been established for this session.';

  const surfaceState: GovernanceSurfaceState = 'unavailable';

  const prepareDraft = useCallback(
    (input: { action: 'grant' | 'revoke'; roleId: string | null; address: string }): GrantRevokeDraft => ({
      action: input.action,
      roleId: input.roleId,
      address: input.address,
      // No role manifest to evaluate real conflicts against yet; an empty
      // list here is correct, not a placeholder "all clear".
      warnings: [],
    }),
    [],
  );

  const refetch = useCallback(async () => {
    // Nothing to refetch while the release manifest is unavailable.
  }, []);

  return useMemo(
    () => ({
      isAuthorized,
      unauthorizedReason,
      canonicalGovernanceOperatorAddress: null,
      account: null,
      surfaceState,
      manifestUnavailable: true,
      manifestUnavailableReason: MANIFEST_UNAVAILABLE_REASON,
      members: [],
      pendingChanges: [],
      separationWarnings: [],
      authoritySources: AUTHORITY_SOURCES,
      prepareDraft,
      refetch,
    }),
    [prepareDraft, refetch],
  );
}