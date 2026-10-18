import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { assertAccessible } from '@/__tests__/utils/axe';
import { DisputeEntryForm } from '@/components/features/disputes/DisputeEntryForm';
import type {
  DisputeEligibility,
  DisputeEvidenceEntry,
  DisputeProjectionOverlay,
} from '@/app/types/dispute-entry';
import { DISPUTE_DRAFT_VERSION } from '@/app/types/dispute-entry';

const CLAIM = '42';
const BOND = '1000000000000000000';
const CHALLENGER = '0x000000000000000000000000000000000000000b';

const ELIGIBLE: DisputeEligibility = {
  status: 'eligible',
  requiredBond: BOND,
  windowEnd: '2026-10-16T00:00:00.000Z',
  observedAtBlock: '1234',
};

const EXISTING_DISPUTE: DisputeEligibility = {
  status: 'existing-dispute',
  disputeId: '7',
  challenger: CHALLENGER,
  openedAt: '2026-10-14T00:00:00.000Z',
};

const EXPIRED_WINDOW: DisputeEligibility = {
  status: 'expired-window',
  windowEnd: '2026-10-14T00:00:00.000Z',
};

const UNSUPPORTED_PHASE: DisputeEligibility = {
  status: 'unsupported-phase',
  phase: 'FINALIZED',
  phaseLabel: 'Finalized',
};

const BOND_CHANGED: DisputeEligibility = {
  status: 'bond-changed',
  requiredBond: '2000000000000000000',
  bondAtDraft: BOND,
};

const UNPINNED: DisputeEligibility = {
  status: 'protocol-unpinned',
  reasons: ['DisputeRegistry address is not pinned in the deployment release'],
};

const REASON = 'The provisional outcome double counted a verifier stake.';

function draft(overrides: Record<string, unknown> = {}) {
  return {
    version: DISPUTE_DRAFT_VERSION,
    claimId: CLAIM,
    reason: 'Saved draft reason text.',
    evidence: [{ uri: 'https://example.com/saved' }],
    bondAtDraft: BOND,
    updatedAt: '2026-10-15T00:00:00.000Z',
    ...overrides,
  };
}

const getSubmitButton = () =>
  screen.getByRole('button', { name: /open dispute/i }) as HTMLButtonElement;

const getReasonField = () =>
  screen.getByLabelText(/reason for dispute/i) as HTMLTextAreaElement;

describe('DisputeEntryForm — eligibility states', () => {
  it('enables the mutation only in the eligible state once input is valid', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(
      <DisputeEntryForm
        claimId={CLAIM}
        eligibility={ELIGIBLE}
        onSubmit={onSubmit}
      />
    );

    const submit = getSubmitButton();
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute('aria-disabled', 'true');

    await user.type(getReasonField(), REASON);
    expect(submit).toBeEnabled();
    expect(submit).toHaveAttribute('aria-disabled', 'false');

    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledWith({
      claimId: CLAIM,
      reason: REASON,
      evidence: [],
      bondAmount: BOND,
    });
  });

  it('shows contract-derived eligibility provenance for the eligible state', () => {
    render(<DisputeEntryForm claimId={CLAIM} eligibility={ELIGIBLE} />);

    const notice = screen.getByTestId('dispute-eligibility-notice');
    expect(notice).toHaveAttribute('data-status', 'eligible');
    expect(notice).toHaveTextContent('observed at block 1234');
    expect(
      screen.getByTestId('dispute-action-availability')
    ).toHaveAttribute('data-available', 'false');
  });

  it.each([
    ['existing-dispute', EXISTING_DISPUTE, /already exists/i],
    ['expired-window', EXPIRED_WINDOW, /closed on/i],
    ['unsupported-phase', UNSUPPORTED_PHASE, /Finalized/],
    ['protocol-unpinned', UNPINNED, /not pinned/i],
  ] as const)(
    'renders the %s state explicitly with a non-interactive mutation',
    async (_status, eligibility, message) => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();
      render(
        <DisputeEntryForm
          claimId={CLAIM}
          eligibility={eligibility}
          onSubmit={onSubmit}
        />
      );

      const notice = screen.getByTestId('dispute-eligibility-notice');
      expect(notice).toHaveAttribute('data-status', _status);
      expect(notice).toHaveTextContent(message);

      const submit = getSubmitButton();
      expect(submit).toBeDisabled();
      expect(submit).toHaveTextContent(/unavailable/i);

      // Even vigorous interaction cannot fire the mutation.
      await user.click(submit);
      await user.type(getReasonField(), REASON);
      await user.click(submit);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(getSubmitButton()).toBeDisabled();
    }
  );

  it('keeps the protocol-unpinned state non-interactive and explains it cannot be enabled from the UI', () => {
    render(<DisputeEntryForm claimId={CLAIM} eligibility={UNPINNED} />);

    const notice = screen.getByTestId('dispute-eligibility-notice');
    expect(notice).toHaveTextContent(/cannot be enabled from the UI/i);
    expect(within(notice).queryByRole('button')).toBeNull();
  });

  it('shows the existing dispute challenger without offering any action', () => {
    render(<DisputeEntryForm claimId={CLAIM} eligibility={EXISTING_DISPUTE} />);

    const notice = screen.getByTestId('dispute-eligibility-notice');
    expect(notice).toHaveTextContent(CHALLENGER);
    expect(within(notice).queryByRole('button')).toBeNull();
  });

  it('offers the bond acknowledgment for bond-changed and passes the new bond up', async () => {
    const user = userEvent.setup();
    const onAcknowledgeBond = jest.fn();
    render(
      <DisputeEntryForm
        claimId={CLAIM}
        eligibility={BOND_CHANGED}
        onAcknowledgeBond={onAcknowledgeBond}
      />
    );

    const notice = screen.getByTestId('dispute-eligibility-notice');
    expect(notice).toHaveAttribute('data-status', 'bond-changed');
    expect(notice).toHaveTextContent(BOND);
    expect(notice).toHaveTextContent('2000000000000000000');
    expect(getSubmitButton()).toBeDisabled();

    const acknowledge = screen.getByRole('button', {
      name: /use updated dispute bond/i,
    });
    await user.click(acknowledge);
    expect(onAcknowledgeBond).toHaveBeenCalledWith('2000000000000000000');
  });
});

describe('DisputeEntryForm — evidence integrity', () => {
  it('blocks submission and reports problems for unsupported schemes', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(
      <DisputeEntryForm
        claimId={CLAIM}
        eligibility={ELIGIBLE}
        onSubmit={onSubmit}
      />
    );

    await user.type(getReasonField(), REASON);
    await user.click(screen.getByRole('button', { name: /add evidence link/i }));

    const uriField = screen.getByLabelText('Evidence link 1');
    await user.type(uriField, 'javascript:alert(1)');

    const problems = await screen.findByTestId('dispute-evidence-problems-0');
    expect(problems).toHaveTextContent(/unsupported scheme/i);
    expect(uriField).toHaveAttribute('aria-invalid', 'true');
    expect(getSubmitButton()).toBeDisabled();

    await user.click(getSubmitButton());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects credential-bearing evidence links (SEC-FE-007)', async () => {
    const user = userEvent.setup();
    render(
      <DisputeEntryForm claimId={CLAIM} eligibility={ELIGIBLE} />
    );

    await user.type(getReasonField(), REASON);
    await user.click(screen.getByRole('button', { name: /add evidence link/i }));
    await user.type(
      screen.getByLabelText('Evidence link 1'),
      'https://example.com/doc?token=secret-value'
    );

    const problems = await screen.findByTestId('dispute-evidence-problems-0');
    expect(problems).toHaveTextContent(/prohibited secret material/i);
  });

  it('flags malformed digests and recovers once fixed', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(
      <DisputeEntryForm
        claimId={CLAIM}
        eligibility={ELIGIBLE}
        onSubmit={onSubmit}
      />
    );

    await user.type(getReasonField(), REASON);
    await user.click(screen.getByRole('button', { name: /add evidence link/i }));
    await user.type(
      screen.getByLabelText('Evidence link 1'),
      'https://example.com/doc'
    );
    await user.type(screen.getByLabelText(/sha-256 digest/i), 'nothex');
    expect(getSubmitButton()).toBeDisabled();

    const digestField = screen.getByLabelText(/sha-256 digest/i);
    await user.clear(digestField);
    await user.type(digestField, 'a'.repeat(64));

    await waitFor(() => expect(getSubmitButton()).toBeEnabled());
    await user.click(getSubmitButton());
    expect(onSubmit).toHaveBeenCalledWith({
      claimId: CLAIM,
      reason: REASON,
      evidence: [
        { uri: 'https://example.com/doc', digest: `0x${'a'.repeat(64)}` },
      ],
      bondAmount: BOND,
    });
  });

  it('lets the user remove an offending evidence row with an accessible control', async () => {
    const user = userEvent.setup();
    render(<DisputeEntryForm claimId={CLAIM} eligibility={ELIGIBLE} />);

    await user.type(getReasonField(), REASON);
    await user.click(screen.getByRole('button', { name: /add evidence link/i }));
    await user.type(
      screen.getByLabelText('Evidence link 1'),
      'data:text/plain,hi'
    );
    await screen.findByTestId('dispute-evidence-problems-0');

    await user.click(
      screen.getByRole('button', { name: /remove evidence link 1/i })
    );
    expect(screen.queryByTestId('dispute-evidence-problems-0')).toBeNull();
  });
});

describe('DisputeEntryForm — draft recovery', () => {
  it('offers a stored draft and restores it via keyboard', async () => {
    const user = userEvent.setup();
    const storedDraft = draft();
    render(
      <DisputeEntryForm
        claimId={CLAIM}
        eligibility={ELIGIBLE}
        storedDraft={storedDraft}
      />
    );

    const banner = screen.getByTestId('dispute-draft-banner');
    expect(banner).toHaveTextContent(/saved dispute draft/i);

    const restore = screen.getByRole('button', { name: /restore draft/i });
    restore.focus();
    expect(restore).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(getReasonField()).toHaveValue('Saved draft reason text.');
    expect(screen.getByLabelText('Evidence link 1')).toHaveValue(
      'https://example.com/saved'
    );
    expect(screen.getByTestId('dispute-draft-restored-note')).toBeInTheDocument();
  });

  it('discards a stored draft without applying it', async () => {
    const user = userEvent.setup();
    const onDraftDiscard = jest.fn();
    render(
      <DisputeEntryForm
        claimId={CLAIM}
        eligibility={ELIGIBLE}
        storedDraft={draft()}
        onDraftDiscard={onDraftDiscard}
      />
    );

    await user.click(screen.getByRole('button', { name: /discard draft/i }));

    expect(onDraftDiscard).toHaveBeenCalled();
    expect(screen.queryByTestId('dispute-draft-banner')).toBeNull();
    expect(getReasonField()).toHaveValue('');
  });

  it('persists edits as sanitized draft inputs', async () => {
    const user = userEvent.setup();
    const onDraftPersist = jest.fn();
    render(
      <DisputeEntryForm
        claimId={CLAIM}
        eligibility={ELIGIBLE}
        onDraftPersist={onDraftPersist}
      />
    );

    await user.type(getReasonField(), REASON);

    await waitFor(() => expect(onDraftPersist).toHaveBeenCalled());
    const last = onDraftPersist.mock.calls.at(-1)![0];
    expect(last.claimId).toBe(CLAIM);
    expect(last.reason).toBe(REASON);
    // The current contract bond is pinned into the draft.
    expect(last.bondAtDraft).toBe(BOND);
  });
});

describe('DisputeEntryForm — projection freshness', () => {
  it('labels API projection data as informational only', () => {
    const projection: DisputeProjectionOverlay = {
      source: 'api-projection',
      asOf: '2026-10-15T00:00:00.000Z',
      claimId: CLAIM,
    };
    render(
      <DisputeEntryForm
        claimId={CLAIM}
        eligibility={ELIGIBLE}
        projection={projection}
      />
    );

    const freshness = screen.getByTestId('dispute-projection-freshness');
    expect(freshness).toHaveTextContent('fetched 2026-10-15T00:00:00.000Z');
    expect(freshness).toHaveTextContent(/contract state governs every action/i);
  });
});

describe('DisputeEntryForm — submission payload', () => {
  it('passes only validated evidence entries and the exact contract bond', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    const evidence: DisputeEvidenceEntry[] = [
      { uri: 'https://example.com/a', digest: 'b'.repeat(64) },
    ];
    render(
      <DisputeEntryForm
        claimId={CLAIM}
        eligibility={ELIGIBLE}
        initialReason={REASON}
        initialEvidence={evidence}
        onSubmit={onSubmit}
      />
    );

    expect(getSubmitButton()).toBeEnabled();
    await user.click(getSubmitButton());
    expect(onSubmit).toHaveBeenCalledWith({
      claimId: CLAIM,
      reason: REASON,
      evidence: [{ uri: 'https://example.com/a', digest: `0x${'b'.repeat(64)}` }],
      bondAmount: BOND,
    });
  });

  it('requires a minimum reason length even when eligible', async () => {
    const onSubmit = jest.fn();
    render(
      <DisputeEntryForm
        claimId={CLAIM}
        eligibility={ELIGIBLE}
        initialReason="short"
        onSubmit={onSubmit}
      />
    );

    expect(getSubmitButton()).toBeDisabled();
    expect(screen.getByTestId('dispute-action-availability')).toHaveTextContent(
      /at least 10 characters/i
    );
  });
});

describe('DisputeEntryForm — accessibility', () => {
  it('has no axe violations in the eligible state', async () => {
    const { container } = render(
      <DisputeEntryForm claimId={CLAIM} eligibility={ELIGIBLE} />
    );
    await assertAccessible(container);
  });

  it('has no axe violations in unavailable states', async () => {
    const states: DisputeEligibility[] = [
      UNPINNED,
      EXPIRED_WINDOW,
      EXISTING_DISPUTE,
      UNSUPPORTED_PHASE,
      BOND_CHANGED,
    ];
    for (const eligibility of states) {
      const { container, unmount } = render(
        <DisputeEntryForm claimId={CLAIM} eligibility={eligibility} />
      );
      await assertAccessible(container);
      unmount();
    }
  });

  it('has no axe violations with evidence problems and a draft banner', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DisputeEntryForm
        claimId={CLAIM}
        eligibility={ELIGIBLE}
        storedDraft={draft()}
      />
    );
    await user.type(getReasonField(), REASON);
    await user.click(screen.getByRole('button', { name: /add evidence link/i }));
    await user.type(
      screen.getByLabelText('Evidence link 1'),
      'javascript:alert(1)'
    );
    await screen.findByTestId('dispute-evidence-problems-0');
    await assertAccessible(container);
  });

  it('keeps the reason field described by its help text', () => {
    render(<DisputeEntryForm claimId={CLAIM} eligibility={ELIGIBLE} />);

    const reasonField = getReasonField();
    const describedBy = reasonField.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(
      document.getElementById(describedBy!.split(' ')[0])
    ).toHaveTextContent(/Drafts are stored on this device only/i);
  });
});
