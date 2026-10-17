/**
 * UI-FE-084 — OpenDispute unsaved-change guard integration.
 *
 * Typing a dispute reason must not be silently lost: closing the modal asks
 * first, a local draft is offered for explicit restore, and an explicit
 * discard clears it.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

import type { DraftScope } from '@/lib/drafts/recoverable-draft';

const SCOPE: DraftScope = { address: null, chainId: null, releaseId: 'test-release' };

jest.mock('@/hooks/useDraftScope', () => ({
  useDraftScope: () => ({ address: null, chainId: null, releaseId: 'test-release' }),
}));

jest.mock('@/hooks/useDisputeContext', () => ({
  useDisputeContext: () => ({
    context: {
      isEligible: true,
      bond: { bondAmount: '1000000000000000000' },
      walletPosition: {
        userAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        currentBalance: '5000000000000000000',
      },
    },
    isLoading: false,
    error: null,
  }),
}));

jest.mock('@/hooks/useDisputeSubmission', () => ({
  useDisputeSubmission: () => ({
    validateDispute: jest.fn(() => ({ isValid: true, errors: [], warnings: [] })),
    simulateDispute: jest.fn(),
    submitDispute: jest.fn(),
    isSimulating: false,
    isSubmitting: false,
    error: null,
    isDisputeSupported: true,
  }),
  formatBondAmount: (wei: string) => {
    try {
      return (Number(BigInt(wei)) / 1e18).toFixed(4);
    } catch {
      return '0.0000';
    }
  },
}));

jest.mock('@/hooks/useWriteReadiness', () => ({
  useWriteReadiness: () => ({
    isReady: true,
    message: null,
    primaryCode: null,
    codes: [],
  }),
}));

jest.mock('@/lib/contracts/registry', () => ({
  getContractAddress: () => '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
}));

import { OpenDispute } from '../OpenDispute';
import { saveLocalDraft } from '@/lib/drafts/recoverable-draft';

const FORM_ID = 'dispute:claim_1';
const DRAFT_KEY = `truthbounty:form-draft:${FORM_ID}`;

const isPayload = (value: unknown): value is { reason: string } =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { reason?: unknown }).reason === 'string';

function typeReason(text: string) {
  fireEvent.change(screen.getByLabelText(/reason for dispute/i), { target: { value: text } });
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('OpenDispute — unsaved-change guard', () => {
  it('asks before closing a modal that holds a dispute reason', () => {
    const onClose = jest.fn();
    render(<OpenDispute claimId="claim_1" isOpen onClose={onClose} />);
    typeReason('This claim is incorrect because evidence is missing.');

    fireEvent.click(screen.getByLabelText(/close dispute modal/i));

    expect(screen.getByRole('dialog', { name: /unsaved changes/i })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the modal open when the user chooses to stay', () => {
    const onClose = jest.fn();
    render(<OpenDispute claimId="claim_1" isOpen onClose={onClose} />);
    typeReason('Stay with my dispute reason.');

    fireEvent.click(screen.getByLabelText(/close dispute modal/i));
    fireEvent.click(screen.getByRole('button', { name: /stay editing/i }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/reason for dispute/i)).toHaveValue(
      'Stay with my dispute reason.',
    );
  });

  it('discards the draft and closes when the user confirms leaving', async () => {
    const onClose = jest.fn();
    // A prior local draft exists and must be cleared by the explicit discard.
    saveLocalDraft(FORM_ID, SCOPE, { reason: 'Prior draft' }, isPayload);
    render(<OpenDispute claimId="claim_1" isOpen onClose={onClose} />);
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();

    typeReason('Discard this reason.');
    fireEvent.click(screen.getByLabelText(/close dispute modal/i));
    fireEvent.click(screen.getByRole('button', { name: /discard and leave/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('keeps the local draft when the user saves it before leaving', async () => {
    const onClose = jest.fn();
    render(<OpenDispute claimId="claim_1" isOpen onClose={onClose} />);
    typeReason('Save this reason.');

    fireEvent.click(screen.getByLabelText(/close dispute modal/i));
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
  });

  it('offers an explicit restore of a compatible dispute draft', () => {
    saveLocalDraft(FORM_ID, SCOPE, { reason: 'Recovered dispute reason' }, isPayload);
    render(<OpenDispute claimId="claim_1" isOpen onClose={jest.fn()} />);

    expect(screen.getByTestId('dispute-draft-restore')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /restore draft/i }));
    expect(screen.getByLabelText(/reason for dispute/i)).toHaveValue('Recovered dispute reason');
    expect(screen.queryByTestId('dispute-draft-restore')).not.toBeInTheDocument();
  });
});
