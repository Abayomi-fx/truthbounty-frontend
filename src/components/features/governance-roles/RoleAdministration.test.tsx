import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { RoleAdministrationContent } from './RoleAdministration';
import type { UseRoleAdministrationDataReturn } from '@/hooks/useRoleAdministrationData';

const MANIFEST_UNAVAILABLE_REASON =
  'No verified release manifest is available yet. Role membership, pending changes, and grant/revoke submission stay unavailable until one is published (see STAB-FE-005).';

function buildData(overrides: Partial<UseRoleAdministrationDataReturn> = {}): UseRoleAdministrationDataReturn {
  return {
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
    ],
    prepareDraft: ({ action, roleId, address }) => ({ action, roleId, address, warnings: [] }),
    refetch: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('RoleAdministrationContent', () => {
  it('renders the access-denied boundary and nothing else when unauthorized', () => {