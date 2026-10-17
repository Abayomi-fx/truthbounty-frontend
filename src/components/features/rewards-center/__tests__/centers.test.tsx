import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { RewardsCenter } from '../RewardsCenter';
import { TransactionCenter } from '../TransactionCenter';
import {
  rewardsFixture,
  transactionFixture,
  HASH,
  REPLACEMENT,
} from '../stories/fixtures';
import type { CenterState } from '../model';

expect.extend(toHaveNoViolations);

it('separates estimates, claimable, pending, finalized, unavailable and slashed entries', () => {
  render(<RewardsCenter data={rewardsFixture} />);
  expect(screen.getAllByText(/API estimate/)[0]).toHaveTextContent(
    'not claimable',
  );
  expect(
    screen.getByText('Contract read · finalized · block 14282901'),
  ).toBeVisible();
  expect(
    screen.getByText('Contract read · confirmed · block 14282902'),
  ).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Slashed stake' })).toBeVisible();
  expect(screen.getByText('Amount unavailable')).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Review withdrawal' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Review withdrawal' }),
  ).toHaveAccessibleDescription(/pinned adapter/);
});

it('does not let a projection claimable flag authorize or label a canonical balance', () => {
  render(
    <RewardsCenter
      data={{
        ...rewardsFixture,
        entries: [
          {
            ...rewardsFixture.entries[0],
            outcome: 'claimable',
            amount: '9007199254740993.123456789012345678',
          },
        ],
      }}
    />,
  );
  expect(
    screen.getAllByText('9007199254740993.123456789012345678')[0],
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Review withdrawal' }),
  ).toBeDisabled();
  expect(screen.queryByText(/Contract read/)).not.toBeInTheDocument();
});

it('filters with the keyboard, retains focus and performs only an explicit read refresh', async () => {
  const user = userEvent.setup();
  const refresh = jest.fn();
  render(<RewardsCenter data={rewardsFixture} onRefresh={refresh} />);
  await user.tab();
  const button = screen.getByRole('button', { name: 'Refresh references' });
  expect(button).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(refresh).toHaveBeenCalledTimes(1);
  const filter = screen.getByRole('combobox', { name: 'Outcome' });
  await user.selectOptions(filter, 'slashed');
  expect(filter).toHaveFocus();
  expect(screen.getByRole('heading', { name: 'Slashed stake' })).toBeVisible();
  expect(
    screen.queryByRole('heading', { name: 'Verifier reward' }),
  ).not.toBeInTheDocument();
});

it.each<CenterState>([
  'loading',
  'empty',
  'stale',
  'offline',
  'unavailable',
  'error',
  'denied',
  'not-found',
])('keeps %s accessible and unavailable for mutation', async (state) => {
  const { container } = render(
    <RewardsCenter data={{ ...rewardsFixture, state, entries: [] }} />,
  );
  expect(
    screen.getByRole('button', { name: 'Review withdrawal' }),
  ).toBeDisabled();
  expect(await axe(container)).toHaveNoViolations();
});

it('marks a cached finalized state as unverified after recovery', async () => {
  const user = userEvent.setup();
  render(
    <TransactionCenter
      records={[transactionFixture('finalized', 'local-reference')]}
    />,
  );
  expect(screen.getByText('Reconciliation required')).toBeVisible();
  expect(screen.queryByText('Transaction finalized.')).not.toBeInTheDocument();
  await user.click(
    screen.getByText('Recovery details for Withdraw 12.00 USDC'),
  );
  expect(
    screen.getByRole('link', { name: /View transaction receipt/ }),
  ).toHaveAttribute('href', 'https://sepolia-optimism.etherscan.io/tx/' + HASH);
  expect(
    screen.queryByRole('button', { name: /retry|submit|sign/i }),
  ).not.toBeInTheDocument();
});

it('preserves both original and replacement references and safe external-link attributes', async () => {
  render(<TransactionCenter records={[transactionFixture('replaced')]} />);
  await userEvent.click(
    screen.getByText('Recovery details for Withdraw 12.00 USDC'),
  );
  const replacement = screen.getByRole('link', { name: /Follow replacement/ });
  expect(replacement).toHaveAttribute(
    'href',
    'https://sepolia-optimism.etherscan.io/tx/' + REPLACEMENT,
  );
  expect(replacement).toHaveAttribute('rel', 'noopener noreferrer');
  expect(replacement).toHaveAttribute('referrerpolicy', 'no-referrer');
  expect(
    screen.getByRole('link', { name: /Original transaction/ }),
  ).toBeVisible();
});

it.each(['reorged', 'dropped', 'indexing', 'safe', 'finalized'] as const)(
  'renders canonical %s with shared status semantics',
  async (status) => {
    const { container } = render(
      <TransactionCenter records={[transactionFixture(status)]} />,
    );
    expect(await axe(container)).toHaveNoViolations();
    if (status === 'safe')
      expect(screen.getByRole('status')).toHaveTextContent('Not finalized');
    if (status === 'reorged')
      expect(screen.getByRole('alert')).toHaveTextContent('reorganization');
  },
);

it('does not route malformed or wrong-chain references to a default explorer', async () => {
  const record = transactionFixture('submitted', 'local-reference');
  render(
    <TransactionCenter
      records={[{ ...record, state: { ...record.state, chainId: 1 } }]}
    />,
  );
  await userEvent.click(
    screen.getByText('Recovery details for Withdraw 12.00 USDC'),
  );
  expect(
    within(screen.getByRole('article')).queryByRole('link'),
  ).not.toBeInTheDocument();
});

it('does not show a merely confirmed withdrawal as finalized value', () => {
  const entry = {
    ...rewardsFixture.entries[3],
    source: {
      kind: 'contract' as const,
      block: '100',
      finality: 'confirmed' as const,
    },
  };
  render(<RewardsCenter data={{ ...rewardsFixture, entries: [entry] }} />);
  const region = screen.getByRole('region', { name: 'Reward entries' });
  expect(within(region).getByText('pending')).toBeVisible();
  expect(within(region).queryByText('withdrawn')).not.toBeInTheDocument();
});
