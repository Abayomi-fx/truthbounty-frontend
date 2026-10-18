/**
 * UI-FE-029 — Accessibility coverage for governed change & timelock UI.
 *
 * Asserts the preparation and execution surfaces are accessible across their
 * canonical states, including blocked, pending-delay, wrong-chain, and reorg.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import { GovernedChangePreparation } from '@/components/features/governed-change/GovernedChangePreparation';
import { TimelockExecutionReview } from '@/components/features/governed-change/TimelockExecutionReview';
import { makeGovernedChangeSnapshot } from '@/testing/fixtures';

import { assertAccessible } from '../utils/axe';

describe('Governed change accessibility', () => {
  it('preparation surface is accessible when ready', async () => {
    const { container } = render(
      <GovernedChangePreparation snapshot={makeGovernedChangeSnapshot()} />,
    );
    await assertAccessible(container);
  });

  it('preparation blocked surface is accessible', async () => {
    const { container } = render(
      <GovernedChangePreparation
        snapshot={makeGovernedChangeSnapshot({
          input: { surfaceState: 'unavailable' },
        })}
      />,
    );
    await assertAccessible(container);
  });

  it('execution surface is accessible when ready', async () => {
    const { container } = render(
      <TimelockExecutionReview snapshot={makeGovernedChangeSnapshot()} />,
    );
    await assertAccessible(container);
  });

  it('execution pending-delay surface is accessible', async () => {
    const snapshot = makeGovernedChangeSnapshot({
      input: {
        proposal: {
          id: '0xabc',
          earliestExecution: new Date(
            Date.parse(
              makeGovernedChangeSnapshot().timelock.earliestExecution as string,
            ) + 3_600_000,
          ).toISOString(),
          delaySeconds: 172_800,
          blockNumber: 1,
        },
      },
    });
    const { container } = render(
      <TimelockExecutionReview snapshot={snapshot} />,
    );
    await assertAccessible(container);
  });

  it('execution wrong-chain surface is accessible', async () => {
    const { container } = render(
      <TimelockExecutionReview
        snapshot={makeGovernedChangeSnapshot({ input: { currentChainId: 1 } })}
      />,
    );
    await assertAccessible(container);
  });

  it('execution reorged surface is accessible', async () => {
    const snapshot = makeGovernedChangeSnapshot({
      input: { execution: { status: 'reorged', txHash: '0xdead' as `0x${string}` } },
    });
    const { container } = render(
      <TimelockExecutionReview snapshot={snapshot} />,
    );
    expect(screen.getByTestId('timelock-execution-reorged')).toBeInTheDocument();
    await assertAccessible(container);
  });
});
