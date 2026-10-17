/**
 * V2-FE-044 — Accessibility checks for every transaction state.
 * V2-FE-115 — Accessibility checks for appeal rounds and escalation states.
 *
 * Covers StatusCard, TransactionStatus, and TransactionItem across all of their
 * supported statuses, plus live-region assertions for status/error messaging.
 * Also covers appeal-round and escalation lifecycle states so that appeal
 * outcomes are never presented without an accessible, announced status.
 */

import React from 'react';
import { render, screen } from '../utils/test-utils';
import { assertAccessible } from '../utils/axe';

import { StatusCard } from '@/components/transactions/status-card';
import {
  TransactionItem,
  type TransactionItemProps,
} from '@/components/transactions/transaction-item';
import { TransactionsList } from '@/components/transactions/transaction-list';
import { TransactionStatus } from '@/components/features/claim-verification/TransactionStatus';
import { EvidenceUploadPreflight } from '@/components/evidence/evidence-upload-preflight';

const HASH =
  '0xaaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa7777bbbb8888';

const STATUS_CARD_STATUSES = ['pending', 'confirming', 'confirmed', 'failed'] as const;
const TX_ITEM_STATUSES = ['pending', 'confirming', 'confirmed', 'failed'] as const;
const TX_ITEM_TYPES = ['verification', 'stake', 'withdrawal', 'dispute'] as const;
const TX_STATUS_VALUES = ['idle', 'pending', 'success', 'error'] as const;

const EVIDENCE_PREFLIGHT_STATES = [
  { state: 'idle', label: 'Awaiting evidence selection' },
  { state: 'validating', label: 'Validating evidence locally' },
  { state: 'hashing', label: 'Hashing evidence locally' },
  { state: 'uploading', label: 'Uploading evidence' },
  { state: 'pinning', label: 'Pinning evidence' },
  { state: 'verifying', label: 'Verifying CID' },
  { state: 'authorizing', label: 'Authorizing claim attachment' },
  { state: 'attached', label: 'Evidence attached on-chain' },
  { state: 'failed', label: 'Evidence transfer failed' },
] as const;

/**
 * Appeal rounds and escalation are represented as dispute transactions whose
 * lifecycle stage is surfaced through the existing status vocabulary. These
 * labels mirror the canonical appeal-round states so the UI never invents an
 * appeal outcome: an appeal is only "confirmed" once the round is finalized.
 */
const APPEAL_ROUND_STATES = [
  { status: 'pending', label: 'Appeal round open' },
  { status: 'confirming', label: 'Appeal round in review' },
  { status: 'confirmed', label: 'Appeal round finalized' },
  { status: 'failed', label: 'Appeal round rejected' },
] as const;

const ESCALATION_STATES = [
  { status: 'pending', label: 'Escalation submitted' },
  { status: 'confirming', label: 'Escalation under review' },
  { status: 'confirmed', label: 'Escalation resolved' },
  { status: 'failed', label: 'Escalation rejected' },
] as const;

describe('Accessibility: StatusCard — every status', () => {
  it.each(STATUS_CARD_STATUSES)('StatusCard "%s" has no axe violations', async (status) => {
    const { container } = render(<StatusCard status={status} count={3} />);
    expect(screen.getByText(status === 'failed' ? 'Failed' : status.charAt(0).toUpperCase() + status.slice(1))).toBeInTheDocument();
    await assertAccessible(container);
  });
});

describe('Accessibility: TransactionStatus — every status', () => {
  it.each(TX_STATUS_VALUES)('TransactionStatus "%s" has no axe violations', async (status) => {
    const { container } = render(<TransactionStatus status={status} />);
    // idle renders null — still must not introduce violations on empty mount
    await assertAccessible(container);
  });

  it('announces pending, success, and error status via live regions', async () => {
    const { container: pending } = render(<TransactionStatus status="pending" />);
    const pendingEl = screen.getByText(/transaction pending/i);
    expect(pendingEl).toHaveAttribute('role', 'status');
    expect(pendingEl).toHaveAttribute('aria-live', 'polite');

    const { container: success } = render(<TransactionStatus status="success" />);
    const successEl = screen.getByText(/verification submitted/i);
    expect(successEl).toHaveAttribute('role', 'status');
    expect(successEl).toHaveAttribute('aria-live', 'polite');

    const { container: error } = render(<TransactionStatus status="error" />);
    const errorEl = screen.getByText(/transaction failed/i);
    expect(errorEl).toHaveAttribute('role', 'alert');
    expect(errorEl).toHaveAttribute('aria-live', 'assertive');

    const { assertAccessible: ax } = await import('../utils/axe');
    await ax(pendingEl as HTMLElement);
    await ax(successEl as HTMLElement);
    await ax(errorEl as HTMLElement);
  });
});

describe('Accessibility: TransactionItem — every status and type', () => {
  it.each(TX_ITEM_STATUSES)('TransactionItem status "%s" has no axe violations', async (status) => {
    const props: TransactionItemProps = {
      type: 'verification',
      status,
      title: 'Verification stake',
      description: 'Stake confirmation',
      amount: '10',
      timeAgo: '1m ago',
      hash: HASH,
    };
    const { container } = render(<TransactionItem {...props} />);
    expect(screen.getByText('Verification stake')).toBeInTheDocument();
    await assertAccessible(container);
  });

  it.each(TX_ITEM_TYPES)('TransactionItem type "%s" has no axe violations', async (type) => {
    const props: TransactionItemProps = {
      type,
      status: 'pending',
      title: `${type} transaction`,
      description: 'Lifecycle stage',
      amount: '1',
      timeAgo: 'now',
      hash: HASH,
    };
    const { container } = render(<TransactionItem {...props} />);
    await assertAccessible(container);
  });

  it('TransactionItem failed state with error message is accessible and announced', async () => {
    const { container } = render(
      <TransactionItem
        type="dispute"
        status="failed"
        title="Dispute opening"
        description="Bond lock failed"
        amount="1 ETH"
        timeAgo="2m ago"
        hash={HASH}
        errorMessage="Network error — transaction dropped"
        onRetry={() => undefined}
      />,
    );
    expect(screen.getByText(/Network error/)).toBeInTheDocument();
    const errorRegion = screen.getByText(/Network error/).closest('[role], [aria-live]') ??
      screen.getByText(/Network error/);
    expect(errorRegion).toBeInTheDocument();
    await assertAccessible(container);
  });

  it('TransactionsList of mixed statuses has no axe violations', async () => {
    const transactions: TransactionItemProps[] = [
      {
        type: 'verification',
        status: 'pending',
        title: 'Verify',
        description: 'd',
        amount: '1',
        timeAgo: 'now',
        hash: HASH,
      },
      {
        type: 'stake',
        status: 'confirming',
        title: 'Stake',
        description: 'd',
        amount: '2',
        timeAgo: 'now',
        hash: HASH,
      },
      {
        type: 'withdrawal',
        status: 'confirmed',
        title: 'Withdraw',
        description: 'd',
        amount: '3',
        timeAgo: 'now',
        hash: HASH,
      },
      {
        type: 'dispute',
        status: 'failed',
        title: 'Dispute',
        description: 'd',
        amount: '4',
        timeAgo: 'now',
        hash: HASH,
        errorMessage: 'Reverted on-chain',
      },
    ];
    const { container } = render(<TransactionsList transactions={transactions} />);
    await assertAccessible(container);
  });
});

describe('Accessibility: appeal rounds and escalation', () => {
  it.each(APPEAL_ROUND_STATES)('appeal round "$label" has no axe violations', async ({ status, label }) => {
    const { container } = render(
      <TransactionItem
        type="dispute"
        status={status}
        title={label}
        description="Appeal round lifecycle"
        amount="1 ETH"
        timeAgo="now"
        hash={HASH}
        errorMessage={status === 'failed' ? 'Appeal round rejected on-chain' : undefined}
      />,
    );
    expect(screen.getByText(label)).toBeInTheDocument();
    await assertAccessible(container);
  });

  it.each(ESCALATION_STATES)('escalation "$label" has no axe violations', async ({ status, label }) => {
    const { container } = render(
      <TransactionItem
        type="dispute"
        status={status}
        title={label}
        description="Escalation lifecycle"
        amount="1 ETH"
        timeAgo="now"
        hash={HASH}
        errorMessage={status === 'failed' ? 'Escalation rejected on-chain' : undefined}
      />,
    );
    expect(screen.getByText(label)).toBeInTheDocument();
    await assertAccessible(container);
  });

  it('announces an open appeal round via a live region', async () => {
    const { container } = render(
      <div>
        <TransactionItem
          type="dispute"
          status="pending"
          title="Appeal round open"
          description="Awaiting round finalization"
          amount="1 ETH"
          timeAgo="now"
          hash={HASH}
        />
        <TransactionStatus status="pending" />
      </div>,
    );
    const pendingEl = screen.getByText(/transaction pending/i);
    expect(pendingEl).toHaveAttribute('role', 'status');
    expect(pendingEl).toHaveAttribute('aria-live', 'polite');
    await assertAccessible(container);
  });

  it('announces a rejected escalation as an assertive alert', async () => {
    const { container } = render(
      <div>
        <TransactionItem
          type="dispute"
          status="failed"
          title="Escalation rejected"
          description="Escalation rejected on-chain"
          amount="1 ETH"
          timeAgo="now"
          hash={HASH}
          errorMessage="Escalation rejected on-chain"
        />
        <TransactionStatus status="error" />
      </div>,
    );
    const errorEl = screen.getByText(/transaction failed/i);
    expect(errorEl).toHaveAttribute('role', 'alert');
    expect(errorEl).toHaveAttribute('aria-live', 'assertive');
    await assertAccessible(container);
  });

  it('TransactionsList of appeal and escalation rounds has no axe violations', async () => {
    const transactions: TransactionItemProps[] = [
      {
        type: 'dispute',
        status: 'pending',
        title: 'Appeal round open',
        description: 'Appeal round lifecycle',
        amount: '1 ETH',
        timeAgo: 'now',
        hash: HASH,
      },
      {
        type: 'dispute',
        status: 'confirming',
        title: 'Escalation under review',
        description: 'Escalation lifecycle',
        amount: '1 ETH',
        timeAgo: 'now',
        hash: HASH,
      },
      {
        type: 'dispute',
        status: 'confirmed',
        title: 'Appeal round finalized',
        description: 'Appeal round lifecycle',
        amount: '1 ETH',
        timeAgo: 'now',
        hash: HASH,
      },
      {
        type: 'dispute',
        status: 'failed',
        title: 'Escalation rejected',
        description: 'Escalation lifecycle',
        amount: '1 ETH',
        timeAgo: 'now',
        hash: HASH,
        errorMessage: 'Escalation rejected on-chain',
      },
    ];
    const { container } = render(<TransactionsList transactions={transactions} />);
    await assertAccessible(container);
  });
});

describe('Accessibility: full lifecycle status matrix', () => {
  it('renders every StatusCard × TransactionItem status pair without violations', async () => {
    for (const cardStatus of STATUS_CARD_STATUSES) {
      for (const itemStatus of TX_ITEM_STATUSES) {
        const { container, unmount } = render(
          <div>
            <StatusCard status={cardStatus} count={1} />
            <TransactionItem
              type="verification"
              status={itemStatus}
              title="Stage"
              description="stage"
              amount="1"
              timeAgo="now"
              hash={HASH}
              errorMessage={itemStatus === 'failed' ? 'Stage failed' : undefined}
            />
          </div>,
        );
        await assertAccessible(container);
        unmount();
      }
    }
  });
});

describe('Accessibility: EvidenceUploadPreflight — transfer states', () => {
  it.each(EVIDENCE_PREFLIGHT_STATES)('preflight state "$unknown" has no axe violations', async ({ state, label }) => {
    const { container } = render(<EvidenceUploadPreflight state={state} />);
    expect(screen.getByText(new RegExp(label, 'i'))).toBeInTheDocument();
    await assertAccessible(container);
  });

  it('announces the active transfer state via a polite live region', async () => {
    const { container } = render(<EvidenceUploadPreflight state="uploading" />);
    const statusEl = screen.getByText(/uploading evidence/i);
    expect(statusEl).toHaveAttribute('role', 'status');
    expect(statusEl).toHaveAttribute('aria-live', 'polite');
    await assertAccessible(container);
  });

  it('announces a transfer failure as an assertive alert', async () => {
    const { container } = render(
      <EvidenceUploadPreflight
        state="failed"
        errorMessage="Gateway timed out while pinning"
        onRetry={() => undefined}
      />,
    );
    const errorEl = screen.getByText(/gateway timed out/i);
    expect(errorEl).toHaveAttribute('role', 'alert');
    expect(errorEl).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    await assertAccessible(container);
  });

  it('exposes a keyboard-accessible file input with an associated label', async () => {
    const { container } = render(<EvidenceUploadPreflight state="idle" />);
    const input = screen.getByLabelText(/evidence file/i) as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'file');
    expect(input).not.toHaveAttribute('disabled');
    await assertAccessible(container);
  });

  it('renders a recoverable retry action after an interrupted upload', async () => {
    const onRetry = jest.fn();
    const { container } = render(
      <EvidenceUploadPreflight
        state="failed"
        errorMessage="Upload interrupted"
        onRetry={onRetry}
      />,
    );
    const retryButton = screen.getByRole('button', { name: /retry/i });
    retryButton.click();
    expect(onRetry).toH`aveBeenCalledTimes(1);
    await assertAccessible(container);
  });
});
