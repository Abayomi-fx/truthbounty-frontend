import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import {
  GuardianPauseControl,
  type GuardianPauseControlData,
} from './GuardianPauseControl';
import {
  resolveGuardianPauseAuthority,
  type GuardianIncidentContext,
  type GuardianModuleState,
  type GuardianPauseRequestState,
  type GuardianPauseSnapshot,
} from '@/lib/guardian';

const GUARDIAN = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const OTHER = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';

const pauseAbi = [
  { type: 'function', name: 'pauseClaimSubmission', stateMutability: 'nonpayable', inputs: [{ type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'pauseVerification', stateMutability: 'nonpayable', inputs: [] , outputs: [] },
  { type: 'function', name: 'pauseDispute', stateMutability: 'nonpayable', inputs: [{ type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'pauseAppeal', stateMutability: 'nonpayable', inputs: [{ type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'pauseRewardDistribution', stateMutability: 'nonpayable', inputs: [{ type: 'bytes32' }], outputs: [] },
] as const;

const incident: GuardianIncidentContext = {
  incidentId: 'INC-2026-0601',
  severity: 'high',
  summary: 'Anomalous dispute submission pattern detected across the dispute engine.',
  detectedAt: '2026-06-01T10:00:00.000Z',
  reference: 'OPS-REF-0601',
  affectedScopes: ['dispute', 'verification'],
  blastRadius: [
    {
      scope: 'dispute',
      moduleLabel: 'Dispute engine',
      affectedOperations: ['openDispute', 'respondToDispute'],
      userImpact: 'New disputes cannot be opened while the module is paused.',
      reversible: true,
    },
    {
      scope: 'verification',
      moduleLabel: 'Verification module',
      affectedOperations: ['submitVerification'],
      userImpact: 'New verifications are rejected while the module is paused.',
      reversible: true,
    },
  ],
};

function buildSnapshot(
  overrides: Partial<Parameters<typeof resolveGuardianPauseAuthority>[0]> = {},
): GuardianPauseSnapshot {
  return resolveGuardianPauseAuthority({
    chainId: 11155420,
    abi: pauseAbi,
    releaseChainId: 11155420,
    account: GUARDIAN,
    guardianAddress: GUARDIAN,
    authorityRead: { status: 'success', hasPauseRole: true, revoked: false, blockNumber: 100n },
    freshness: { status: 'fresh', ageMs: 500, observedAtBlock: 100n },
    manifestVerified: true,
    ...overrides,
  });
}

const activeDispute: GuardianModuleState = {
  scope: 'dispute',
  pauseState: 'active',
  observedAtBlock: 100n,
  confirmedOnChain: true,
};

function buildData(
  overrides: Partial<GuardianPauseControlData> = {},
): GuardianPauseControlData {
  return {
    snapshot: buildSnapshot(),
    moduleStates: [activeDispute],
    requestState: 'idle' as GuardianPauseRequestState,
    isReadingAuthority: false,
    requestPause: async () => ({ ok: true, txHash: ('0x' + '1'.repeat(64)) as `0x${string}` }),
    resetRequest: () => {},
    refetchAuthority: () => {},
    ...overrides,
  };
}

const meta: Meta<typeof GuardianPauseControl> = {
  title: 'Guardian/GuardianPauseControl',
  component: GuardianPauseControl,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Fail-closed operation-scoped emergency guardian pause control. Authority is proven by the pinned manifest/ABI and canonical on-chain reads.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof GuardianPauseControl>;

export const ReadyPermission: Story = {
  args: { incident, data: buildData() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const status = canvas.getByTestId('guardian-pause-status');
    expect(status.getAttribute('data-allows-pause')).toBe('true');

    const dispute = canvas.getByRole('radio', { name: /dispute opening/i });
    expect((dispute as HTMLInputElement).disabled).toBe(false);
    await userEvent.click(dispute);

    const requestButton = canvas.getByRole('button', { name: /request pause/i });
    expect((requestButton as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(requestButton);

    const dialog = within(canvas.getByTestId('guardian-pause-confirm-modal'));
    const confirm = dialog.getByRole('button', { name: /request pause/i }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await userEvent.type(dialog.getByLabelText(/type pause to request the pause/i), 'PAUSE');
    expect(confirm.disabled).toBe(false);
    await userEvent.click(confirm);

    const phase = canvas.getByTestId('guardian-pause-phase');
    expect(phase.getAttribute('data-request-state')).toBe('submitted');
    expect(phase.getAttribute('data-paused-onchain')).toBe('false');
    expect(canvas.getByTestId('guardian-pause-feedback')).not.toBeNull();
  },
};

export const DeniedNonGuardian: Story = {
  args: { incident, data: buildData({ snapshot: buildSnapshot({ account: OTHER }) }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('guardian-pause-status').getAttribute('data-status')).toBe(
      'authority_unknown',
    );
    expect(canvas.getByTestId('guardian-pause-blocked')).not.toBeNull();
    for (const radio of canvas.getAllByRole('radio')) {
      expect((radio as HTMLInputElement).disabled).toBe(true);
    }
    expect(canvas.queryByRole('button', { name: /unpause/i })).toBeNull();
    expect(canvas.queryByRole('button', { name: /upgrade/i })).toBeNull();
    expect(canvas.queryByRole('button', { name: /settle/i })).toBeNull();
  },
};

export const WrongNetwork: Story = {
  args: { incident, data: buildData({ snapshot: buildSnapshot({ chainId: 10 }) }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('guardian-pause-status').getAttribute('data-status')).toBe(
      'wrong_network',
    );
    expect(canvas.getByTestId('guardian-pause-blocked')).not.toBeNull();
    expect(
      (canvas.getByRole('button', { name: /request pause/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  },
};

export const NoAbiPauseSupport: Story = {
  args: { incident, data: buildData({ snapshot: buildSnapshot({ abi: [] }) }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('guardian-pause-status').getAttribute('data-status')).toBe(
      'no_abi_pause_support',
    );
    expect(canvas.getByTestId('guardian-abi-proofs')).toHaveTextContent(/none/i);
  },
};

export const RevokedAuthority: Story = {
  args: {
    incident,
    data: buildData({
      snapshot: buildSnapshot({
        authorityRead: { status: 'success', hasPauseRole: true, revoked: true, blockNumber: 1n },
      }),
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('guardian-pause-status').getAttribute('data-status')).toBe(
      'authority_revoked',
    );
    expect(canvas.getByTestId('guardian-pause-blocked')).not.toBeNull();
  },
};

export const StaleAuthority: Story = {
  args: {
    incident,
    data: buildData({
      snapshot: buildSnapshot({
        freshness: { status: 'stale', ageMs: 999_999, observedAtBlock: 1n },
      }),
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('guardian-pause-status').getAttribute('data-status')).toBe(
      'stale_data',
    );
    expect(canvas.getByTestId('guardian-pause-blocked')).not.toBeNull();
  },
};

export const RequestPending: Story = {
  args: {
    incident,
    data: buildData({ requestState: 'submitted', moduleStates: [activeDispute] }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const phase = canvas.getByTestId('guardian-pause-phase');
    expect(phase.getAttribute('data-request-state')).toBe('submitted');
    expect(phase.getAttribute('data-onchain-state')).toBe('active');
    expect(phase.getAttribute('data-paused-onchain')).toBe('false');
    expect(canvas.getByTestId('guardian-onchain-label')).toHaveTextContent(/not paused/i);
  },
};

export const ConfirmedPaused: Story = {
  args: {
    incident,
    data: buildData({
      moduleStates: [
        { scope: 'dispute', pauseState: 'paused', observedAtBlock: 101n, confirmedOnChain: true },
      ],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', { name: /dispute opening/i }));
    const phase = canvas.getByTestId('guardian-pause-phase');
    expect(phase.getAttribute('data-onchain-state')).toBe('paused');
    expect(phase.getAttribute('data-paused-onchain')).toBe('true');
  },
};

export const IncompleteIncident: Story = {
  args: {
    incident: { ...incident, blastRadius: [] },
    data: buildData(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('guardian-incident-review').getAttribute('data-complete')).toBe(
      'false',
    );
    expect(canvas.getByTestId('guardian-pause-blocked')).not.toBeNull();
    expect(
      (canvas.getByRole('button', { name: /request pause/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  },
};
