/**
 * UI-FE-084 — ClaimSubmissionWizard unsaved-change guard integration.
 *
 * Replaces the ambiguous window.confirm with the accessible guard dialog and
 * protects refresh/back/Escape while nontrivial claim input is present.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const actions = {
  goToStep: jest.fn(),
  nextStep: jest.fn(),
  previousStep: jest.fn(),
  reset: jest.fn(),
  updateClaimDetails: jest.fn(),
  markFieldTouched: jest.fn(),
  validateCurrentStep: jest.fn(() => true),
  updateEvidence: jest.fn(),
  setTransactionHash: jest.fn(),
  setClaimId: jest.fn(),
  setError: jest.fn(),
};

const emptyDetails = {
  title: '',
  category: '',
  impact: '',
  source: '',
  description: '',
};

let wizardState: Record<string, unknown> = {
  currentStep: 'claim-details',
  claimDetails: emptyDetails,
  claimErrors: {},
  touchedFields: new Set(),
  evidence: { source: null },
  transactionHash: null,
  claimId: null,
  error: null,
};

jest.mock('@/hooks/useClaimSubmissionWizard', () => ({
  useClaimSubmissionWizard: () => [wizardState, actions],
}));

import ClaimSubmissionWizard from '../ClaimSubmissionWizard';

beforeEach(() => {
  jest.clearAllMocks();
  wizardState = {
    currentStep: 'claim-details',
    claimDetails: { ...emptyDetails },
    claimErrors: {},
    touchedFields: new Set(),
    evidence: { source: null },
    transactionHash: null,
    claimId: null,
    error: null,
  };
});

afterEach(() => {
  cleanup();
});

function dispatchUnload(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('ClaimSubmissionWizard — unsaved-change guard', () => {
  it('closes immediately when nothing was entered', () => {
    const onClose = jest.fn();
    render(<ClaimSubmissionWizard onClose={onClose} />);
    fireEvent.click(screen.getByLabelText(/close wizard/i));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: /unsaved changes/i })).not.toBeInTheDocument();
  });

  it('asks before discarding entered claim details', () => {
    const onClose = jest.fn();
    wizardState.claimDetails = { ...emptyDetails, title: 'My claim' };
    render(<ClaimSubmissionWizard onClose={onClose} />);

    fireEvent.click(screen.getByLabelText(/close wizard/i));

    expect(screen.getByRole('dialog', { name: /unsaved changes/i })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('stays on explicit cancel', () => {
    const onClose = jest.fn();
    wizardState.claimDetails = { ...emptyDetails, title: 'My claim' };
    render(<ClaimSubmissionWizard onClose={onClose} />);

    fireEvent.click(screen.getByLabelText(/close wizard/i));
    fireEvent.click(screen.getByRole('button', { name: /stay editing/i }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes after explicit discard', async () => {
    const onClose = jest.fn();
    wizardState.claimDetails = { ...emptyDetails, title: 'My claim' };
    render(<ClaimSubmissionWizard onClose={onClose} />);

    fireEvent.click(screen.getByLabelText(/close wizard/i));
    fireEvent.click(screen.getByRole('button', { name: /discard and leave/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('blocks refresh/back while claim details are unsaved', () => {
    wizardState.claimDetails = { ...emptyDetails, title: 'My claim' };
    render(<ClaimSubmissionWizard onClose={jest.fn()} />);
    expect(dispatchUnload()).toBe(true);
  });

  it('releases the guard once the submission is confirmed', () => {
    wizardState.currentStep = 'confirmation';
    wizardState.claimDetails = { ...emptyDetails, title: 'My claim' };
    render(<ClaimSubmissionWizard onClose={jest.fn()} />);
    expect(dispatchUnload()).toBe(false);
  });

  it('routes Escape through the guard', () => {
    const onClose = jest.fn();
    wizardState.claimDetails = { ...emptyDetails, title: 'My claim' };
    render(<ClaimSubmissionWizard onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.getByRole('dialog', { name: /unsaved changes/i })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
