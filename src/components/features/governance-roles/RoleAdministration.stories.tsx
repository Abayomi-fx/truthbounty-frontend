import type { Meta, StoryObj } from '@storybook/react';

import { RoleAdministration } from './RoleAdministration';
import type { UseRoleAdministrationDataReturn } from '@/hooks/useRoleAdministrationData';

const MANIFEST_UNAVAILABLE_REASON =
  'No verified release manifest is available yet. Role membership, pending changes, and grant/revoke submission stay unavailable until one is published (see STAB-FE-005).';

const mockBaseData: UseRoleAdministrationDataReturn = {
  isAuthorized: true,
  unauthorizedReason: null,
  canonicalGovernanceOperatorAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  account: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  surfaceState: 'unavailable',
  manifestUnavailable: true,
  manifestUnavailableReason: MANIFEST_UNAVAILABLE_REASON,
  members: [],
  pendingChanges: [],
  separationWarnings: [],
  authoritySources: [
    { field: 'Role membership', source: 'pinned-contract', unavailableReason: MANIFEST_UNAVAILABLE_REASON },
    {
      field: 'Pending change lifecycle',
      source: 'pinned-contract',
      unavailableReason: MANIFEST_UNAVAILABLE_REASON,
    },
    { field: 'Timelock readiness', source: 'pinned-contract', unavailableReason: MANIFEST_UNAVAILABLE_REASON },
    {
      field: 'Role/capability identifiers',
      source: 'verified-release-manifest',
      unavailableReason: MANIFEST_UNAVAILABLE_REASON,