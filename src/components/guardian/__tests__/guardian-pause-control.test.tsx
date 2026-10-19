/**
 * UI-FE-032 — Emergency Guardian Pause Control component tests.
 *
 * Verifies negative capabilities (fail closed), scope restriction, request vs
 * on-chain pause separation, keyboard access, and a11y.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import { GuardianPauseControl } from '@/components/guardian/GuardianPauseControl';
import { GuardianPauseConfirmationModal } from '@/components/guardian/GuardianPauseConfirmationModal';
import type { GuardianPauseControlData } from '@/components/guardian/GuardianPauseControl';
import {
  resolveGuardianPauseAuthority,
  type GuardianIncidentContext,
  type GuardianModuleState,
  type GuardianPauseRequestState,
  type GuardianPauseSnapshot,
} from '@/lib/guardian';

expect.extend(toHaveNoViolations);

const GUARDIAN = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const OTHER = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';

const pauseAbi = [
  { type: 'function', name: 'pauseClaimSubmission', stateMutability: 'nonpayable', inputs: [{ type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'pauseVerification', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'pauseDispute', stateMutability: 'nonpayable', inputs: [{ type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'pauseAppeal', stateMutability: 'nonpayable', inputs: [{ type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'pauseRewardDistribution', stateMutability: 'nonpayable', inputs: [{ type: 'bytes32' }], outputs: [] },
] as const;

const incident: GuardianIncidentContext = {
  incidentId: 'INC-2026-0601',
  severity: 'high',
  summary: 'Anomalous dispute submission pattern detected.',
  detectedAt: '2026-06-01T10:00:00.000Z',
  reference: 'OPS-REF-0601',
  affectedScopes: ['dispute', 'verification'],
  blastRadius: [
    {
      scope: 'dispute',
      moduleLabel: 'Dispute engine',
      affectedOperations: ['openDispute'],
      userImpact: 'New disputes cannot be opened while paused.',
      reversible: true,
    },
    {
      scope: 'verification',
      moduleLabel: 'Verification module',
      affectedOperations: ['submitVerification'],
      userImpact: 'New verifications are rejected while paused.',
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
    authorityRead: {
      status: 'success',
      hasPauseRole: true,
      revoked: false,
      blockNumber: 100n,
    },
    freshness: { status: 'fresh', ageMs: 500, observedAtBlock: 100n },
    manifestVerified: true,
    ...overrides,
  });
}

function buildData(overrides: Partial<GuardianPauseControlData> = {}): GuardianPauseControlData {
  return {
    snapshot: buildSnapshot(),
    moduleStates: [
      { scope: 'dispute', pauseState: 'active', observedAtBlock: 100n, confirmedOnChain: true },
    ],
    requestState: 'idle' as GuardianPauseRequestState,
    isReadingAuthority: false,
    requestPause: jest.fn().mockResolvedValue({ ok: true, txHash: '0x' + '1'.repeat(64) }),
    resetRequest: jest.fn(),
    refetchAuthority: jest.fn(),
    ...overrides,
  };
}

describe('GuardianPauseControl — fail-closed authority', () => {
  it('renders disabled when the pinned ABI proves no pause scope', () => {
    render(
      <GuardianPauseControl
        incident={incident}
        data={buildData({ snapshot: buildSnapshot({ abi: [] }) })}
      />,
    );

    expect(screen.getByTestId('guardian-pause-status')).toHaveAttribute(
      'data-status',
      'no_abi_pause_support',
    );
    expect(screen.getByTestId('guardian-pause-blocked')).toBeInTheDocument();
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: /request pause/i })).toBeDisabled();
  });

  it.each([
    ['wrong network', { chainId: 10 }, 'wrong_network'],
    ['revoked authority', { authorityRead: { status: 'success', hasPauseRole: true, revoked: true, blockNumber: 1n } }, 'authority_revoked'],
    ['stale data', { freshness: { status: 'stale', ageMs: 999999, observedAtBlock: 1n } }, 'stale_data'],
    ['non-guardian', { account: OTHER }, 'authority_unknown'],
  ])('disables all actions when %s', (_label, overrides, status) => {
    render(
      <GuardianPauseControl
        incident={incident}
        data={buildData({ snapshot: buildSnapshot(overrides as never) })}
      />,
    );

    const statusEl = screen.getByTestId('guardian-pause-status');
    expect(statusEl).toHaveAttribute('data-status', status);
    expect(statusEl).toHaveAttribute('data-allows-pause', 'false');
    expect(screen.getByTestId('guardian-pause-blocked')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request pause/i })).toBeDisabled();
  });

  it('restricts rendered controls to approved pause scopes only', () => {
    render(<GuardianPauseControl incident={incident} data={buildData()} />);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);

    for (const forbidden of [
      /unpause/i,
      /upgrade/i,
      /withdraw treasury/i,
      /settle/i,
      /transfer role|grant role/i,
    ]) {
      expect(screen.queryByRole('button', { name: forbidden })).not.toBeInTheDocument();
      expect(screen.queryByRole('radio', { name: forbidden })).not.toBeInTheDocument();
    }
  });

  it('only enables scopes that are both ABI-proven and incident-covered', () => {
    render(<GuardianPauseControl incident={incident} data={buildData()} />);

    const dispute = screen.getByRole('radio', { name: /dispute opening/i });
    const verification = screen.getByRole('radio', { name: /verification/i });
    const appeal = screen.getByRole('radio', { name: /appeal/i });

    expect(dispute).toBeEnabled();
    expect(verification).toBeEnabled();
    expect(appeal).toBeDisabled();
    expect(
      screen.getByTestId('guardian-scope-reason-appeal'),
    ).toHaveTextContent(/not covered by the current incident/i);
  });
});

describe('GuardianPauseControl — request vs on-chain pause', () => {
  it('does not claim a module is paused for an idle request', () => {
    render(<GuardianPauseControl incident={incident} data={buildData()} />);
    expect(screen.getByTestId('guardian-pause-phase')).toHaveAttribute(
      'data-paused-onchain',
      'false',
    );
    expect(screen.getByTestId('guardian-onchain-label')).toHaveTextContent(
      /unknown|not paused/i,
    );
  });

  it('keeps an on-chain pause distinct from a submitted request', async () => {
    const user = userEvent.setup();
    const moduleStates: GuardianModuleState[] = [
      { scope: 'dispute', pauseState: 'paused', observedAtBlock: 101n, confirmedOnChain: true },
    ];
    render(
      <GuardianPauseControl
        incident={incident}
        data={buildData({ requestState: 'submitted', moduleStates })}
      />,
    );

    await user.click(screen.getByRole('radio', { name: /dispute opening/i }));

    const phase = screen.getByTestId('guardian-pause-phase');
    expect(phase).toHaveAttribute('data-request-state', 'submitted');
    expect(phase).toHaveAttribute('data-onchain-state', 'paused');
    expect(phase).toHaveAttribute('data-paused-onchain', 'true');
  });

  it('submits a request without rendering the module as paused', async () => {
    const user = userEvent.setup();
    const requestPause = jest.fn().mockResolvedValue({ ok: true });
    render(
      <GuardianPauseControl
        incident={incident}
        data={buildData({ requestPause })}
      />,
    );

    await user.click(screen.getByRole('radio', { name: /dispute opening/i }));
    await user.click(screen.getByRole('button', { name: /request pause/i }));

    const dialog = screen.getByTestId('guardian-pause-confirm-modal');
    const confirmButton = within(dialog).getByRole('button', {
      name: /request pause/i,
    });
    expect(confirmButton).toBeDisabled();

    await user.type(
      within(dialog).getByLabelText(/type pause to request the pause/i),
      'PAUSE',
    );
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    expect(requestPause).toHaveBeenCalledWith('dispute');
    expect(await screen.findByTestId('guardian-pause-feedback')).toHaveTextContent(
      /not paused until a canonical read confirms/i,
    );
    expect(screen.getByTestId('guardian-pause-phase')).toHaveAttribute(
      'data-paused-onchain',
      'false',
    );
  });
});

describe('GuardianPauseConfirmationModal', () => {
  it('closes on Escape and never renders forbidden capabilities', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(
      <GuardianPauseConfirmationModal
        isOpen
        scope="dispute"
        incident={incident}
        moduleState={null}
        onClose={onClose}
        onConfirm={jest.fn()}
      />,
    );

    expect(screen.getByRole('dialog')).toHaveAccessibleName(/request emergency pause/i);
    expect(screen.queryByRole('button', { name: /unpause/i })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('GuardianPauseControl — incident gating & accessibility', () => {
  it('blocks execution when incident context is incomplete', () => {
    render(
      <GuardianPauseControl
        incident={{ ...incident, blastRadius: [] }}
        data={buildData()}
      />,
    );
    expect(screen.getByTestId('guardian-incident-review')).toHaveAttribute(
      'data-complete',
      'false',
    );
    expect(screen.getByTestId('guardian-pause-blocked')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request pause/i })).toBeDisabled();
  });

  it('has no axe violations in the ready state', async () => {
    const { container } = render(
      <GuardianPauseControl incident={incident} data={buildData()} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations in the blocked state', async () => {
    const { container } = render(
      <GuardianPauseControl
        incident={incident}
        data={buildData({ snapshot: buildSnapshot({ abi: [] }) })}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
