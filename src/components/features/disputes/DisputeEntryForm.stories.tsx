import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { DisputeEntryForm } from './DisputeEntryForm';
import { DISPUTE_DRAFT_VERSION } from '@/app/types/dispute-entry';
import type { DisputeEligibility } from '@/app/types/dispute-entry';

const CLAIM = '42';
const BOND = '1000000000000000000';
const REASON = 'The provisional outcome double counted a verifier stake.';

const ELIGIBLE: DisputeEligibility = {
  status: 'eligible',
  requiredBond: BOND,
  windowEnd: '2026-10-16T00:00:00.000Z',
  observedAtBlock: '1234',
};

const EXISTING_DISPUTE: DisputeEligibility = {
  status: 'existing-dispute',
  disputeId: '7',
  challenger: '0x000000000000000000000000000000000000000b',
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

const STORED_DRAFT = {
  version: DISPUTE_DRAFT_VERSION,
  claimId: CLAIM,
  reason: 'Saved draft reason text.',
  evidence: [{ uri: 'https://example.com/saved' }],
  bondAtDraft: BOND,
  updatedAt: '2026-10-15T00:00:00.000Z',
};

const meta = {
  title: 'Features/DisputeEntryForm',
  component: DisputeEntryForm,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div
        style={{
          background: '#0a0a0a',
          borderRadius: 8,
          padding: 24,
          width: 560,
          minWidth: 320,
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    claimId: CLAIM,
    eligibility: ELIGIBLE,
    onSubmit: fn(),
    onDraftPersist: fn(),
    onDraftDiscard: fn(),
    onAcknowledgeBond: fn(),
    onRefresh: fn(),
  },
} satisfies Meta<typeof DisputeEntryForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Every contract gate passed: the mutation is enabled only after a valid
 * reason, and the submission carries the exact contract-required bond.
 */
export const Eligible: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    const submit = canvas.getByRole('button', { name: /open dispute/i });
    expect(submit.getAttribute('aria-disabled')).toBe('true');
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    await user.type(canvas.getByLabelText(/reason for dispute/i), REASON);
    expect((submit as HTMLButtonElement).disabled).toBe(false);

    await user.click(submit);
    await expect(args.onSubmit).toHaveBeenCalledWith({
      claimId: CLAIM,
      reason: REASON,
      evidence: [],
      bondAmount: BOND,
    });
  },
};

/** A dispute already exists on-chain: explicit and non-interactive. */
export const ExistingDispute: Story = {
  args: { eligibility: EXISTING_DISPUTE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    const notice = canvas.getByTestId('dispute-eligibility-notice');
    expect(notice.getAttribute('data-status')).toBe('existing-dispute');
    expect(notice.textContent).toMatch(/already exists/i);
    expect(within(notice).queryByRole('button')).toBeNull();

    const submit = canvas.getByRole('button', { name: /open dispute/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(submit.textContent).toMatch(/unavailable/i);

    await user.type(canvas.getByLabelText(/reason for dispute/i), REASON);
    expect(submit.disabled).toBe(true);
  },
};

/** The dispute window closed on-chain: explicit and non-interactive. */
export const ExpiredWindow: Story = {
  args: { eligibility: EXPIRED_WINDOW },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const notice = canvas.getByTestId('dispute-eligibility-notice');
    expect(notice.getAttribute('data-status')).toBe('expired-window');
    expect(notice.textContent).toMatch(/closed on/i);

    const submit = canvas.getByRole('button', { name: /open dispute/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  },
};

/** The claim is in a phase that does not allow disputes: non-interactive. */
export const UnsupportedPhase: Story = {
  args: { eligibility: UNSUPPORTED_PHASE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const notice = canvas.getByTestId('dispute-eligibility-notice');
    expect(notice.getAttribute('data-status')).toBe('unsupported-phase');
    expect(notice.textContent).toMatch(/Finalized/);

    const submit = canvas.getByRole('button', { name: /open dispute/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  },
};

/**
 * The contract-side bond changed since the draft was created; the mutation
 * stays blocked until the new bond is explicitly acknowledged.
 */
export const BondChanged: Story = {
  args: { eligibility: BOND_CHANGED },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    const notice = canvas.getByTestId('dispute-eligibility-notice');
    expect(notice.getAttribute('data-status')).toBe('bond-changed');

    const submit = canvas.getByRole('button', { name: /open dispute/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    await user.click(
      canvas.getByRole('button', { name: /use updated dispute bond/i })
    );
    await expect(args.onAcknowledgeBond).toHaveBeenCalledWith(
      '2000000000000000000'
    );
  },
};

/** Credential-bearing / unsafe evidence links are rejected and block submission. */
export const EvidenceIntegrityViolation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    await user.type(canvas.getByLabelText(/reason for dispute/i), REASON);
    await user.click(
      canvas.getByRole('button', { name: /add evidence link/i })
    );
    await user.type(
      canvas.getByLabelText('Evidence link 1'),
      'javascript:alert(1)'
    );

    const problems = await canvas.findByTestId('dispute-evidence-problems-0');
    expect(problems.textContent).toMatch(/unsupported scheme/i);

    const submit = canvas.getByRole('button', { name: /open dispute/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    // Fixing the link restores the mutation.
    const uriField = canvas.getByLabelText('Evidence link 1') as HTMLInputElement;
    await user.clear(uriField);
    await user.type(uriField, 'https://example.com/evidence');
    const fixedSubmit = canvas.getByRole('button', {
      name: /open dispute/i,
    }) as HTMLButtonElement;
    expect(fixedSubmit.disabled).toBe(false);
  },
};

/** A previously saved draft is offered back explicitly — restore via keyboard. */
export const DraftRecovery: Story = {
  args: { storedDraft: STORED_DRAFT },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    const banner = canvas.getByTestId('dispute-draft-banner');
    expect(banner.textContent).toMatch(/saved dispute draft/i);

    const restore = canvas.getByRole('button', { name: /restore draft/i });
    restore.focus();
    expect(document.activeElement).toBe(restore);
    await user.keyboard('{Enter}');

    const reasonField = canvas.getByLabelText(
      /reason for dispute/i
    ) as HTMLTextAreaElement;
    expect(reasonField.value).toBe('Saved draft reason text.');
    expect(
      (canvas.getByLabelText('Evidence link 1') as HTMLInputElement).value
    ).toBe('https://example.com/saved');
    expect(canvas.getByTestId('dispute-draft-restored-note')).toBeTruthy();
    expect(args.onDraftDiscard).not.toHaveBeenCalled();
  },
};

/** A stored draft can also be discarded without applying it. */
export const DraftDiscarded: Story = {
  args: { storedDraft: STORED_DRAFT },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    await user.click(
      canvas.getByRole('button', { name: /discard draft/i })
    );
    await expect(args.onDraftDiscard).toHaveBeenCalled();
    expect(canvas.queryByTestId('dispute-draft-banner')).toBeNull();
    expect(
      (canvas.getByLabelText(/reason for dispute/i) as HTMLTextAreaElement).value
    ).toBe('');
  },
};

/**
 * Contract authority is not pinned for this deployment: the mutation is
 * unavailable, explicit, and cannot be enabled from the UI.
 */
export const UnpinnedAuthority: Story = {
  args: { eligibility: UNPINNED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    const notice = canvas.getByTestId('dispute-eligibility-notice');
    expect(notice.getAttribute('data-status')).toBe('protocol-unpinned');
    expect(notice.textContent).toMatch(/not pinned/i);
    expect(notice.textContent).toMatch(/cannot be enabled from the UI/i);
    expect(within(notice).queryByRole('button')).toBeNull();

    const submit = canvas.getByRole('button', { name: /open dispute/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    await user.click(submit);
    expect(submit.disabled).toBe(true);
  },
};

/** Freshness-labelled API projection data — informational, never authority. */
export const ProjectionFreshness: Story = {
  args: {
    projection: {
      source: 'api-projection',
      asOf: '2026-10-15T00:00:00.000Z',
      claimId: CLAIM,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const freshness = canvas.getByTestId('dispute-projection-freshness');
    expect(freshness.textContent).toMatch(
      /contract state governs every action/i
    );
  },
};
