/**
 * UI-FE-029 — Governed change preparation & timelock execution review tests.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { makeGovernedChangeSnapshot } from '@/testing/fixtures';

import { GovernedChangePreparation } from '../GovernedChangePreparation';
import { TimelockExecutionReview } from '../TimelockExecutionReview';

const REQUIRED_CHAIN = 11155420;

describe('GovernedChangePreparation', () => {
  it('renders the configuration comparison, dependencies, and rollback', () => {
    render(<GovernedChangePreparation snapshot={makeGovernedChangeSnapshot()} />);

    expect(screen.getByTestId('governed-change-preparation')).toBeInTheDocument();
    expect(screen.getByTestId('governed-parameter-threshold')).toHaveAttribute(
      'data-changed',
      'true',
    );
    expect(screen.getByTestId('governed-dependency-audit-signoff')).toHaveAttribute(
      'data-satisfied',
      'true',
    );
    expect(screen.getByTestId('governed-change-rollback')).toHaveAttribute(
      'data-rolled-back',
      'true',
    );
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('calls onPrepare with the exact supported call', () => {
    const onPrepare = jest.fn();
    const snapshot = makeGovernedChangeSnapshot();
    render(
      <GovernedChangePreparation snapshot={snapshot} onPrepare={onPrepare} />,
    );

    fireEvent.click(screen.getByTestId('governed-change-prepare-button'));

    expect(onPrepare).toHaveBeenCalledTimes(1);
    expect(onPrepare.mock.calls[0][0]).toMatchObject({
      changeKey: 'settlement-finality-threshold',
      targetResource: 'TruthBountyWeighted#setSettlementFinalityThreshold',
      target: { method: 'setSettlementFinalityThreshold', parameters: ['64'] },
    });
  });

  it('disables preparation and shows reasons when the rollback is unverified', () => {
    const onPrepare = jest.fn();
    const snapshot = makeGovernedChangeSnapshot({
      input: {
        rollback: { steps: ['restore previous threshold'], verified: false, evidence: null },
      },
    });
    render(
      <GovernedChangePreparation snapshot={snapshot} onPrepare={onPrepare} />,
    );

    const button = screen.getByTestId('governed-change-prepare-button');
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onPrepare).not.toHaveBeenCalled();
    expect(
      screen.getAllByText(/rollback plan is not verified/i).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('shows the blocked state when the surface is not ready', () => {
    const snapshot = makeGovernedChangeSnapshot({
      input: { surfaceState: 'unavailable' },
    });
    render(<GovernedChangePreparation snapshot={snapshot} />);

    expect(screen.getByTestId('governed-change-blocked')).toBeInTheDocument();
    expect(
      screen.queryByTestId('governed-change-prepare-button'),
    ).not.toBeInTheDocument();
  });
});

describe('TimelockExecutionReview', () => {
  it('shows the exact call and timelock readiness', () => {
    render(<TimelockExecutionReview snapshot={makeGovernedChangeSnapshot()} />);

    expect(screen.getByTestId('timelock-call-target')).toHaveTextContent(
      'TruthBountyWeighted',
    );
    expect(screen.getByTestId('timelock-call-method')).toHaveTextContent(
      'setSettlementFinalityThreshold',
    );
    expect(screen.getByTestId('timelock-readiness')).toHaveAttribute(
      'data-ready',
      'true',
    );
  });

  it('enables execution and calls onExecute when ready', () => {
    const onExecute = jest.fn();
    const snapshot = makeGovernedChangeSnapshot();
    render(<TimelockExecutionReview snapshot={snapshot} onExecute={onExecute} />);

    const button = screen.getByTestId('timelock-execute-button');
    expect(button).toBeEnabled();

    fireEvent.click(button);
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute.mock.calls[0][0].targetResource).toBe(
      'TruthBountyWeighted#setSettlementFinalityThreshold',
    );
  });

  it('disables execution before the timelock delay elapses', () => {
    const snapshot = makeGovernedChangeSnapshot({
      input: {
        proposal: {
          id: '0xabc',
          earliestExecution: new Date(
            Date.parse(makeGovernedChangeSnapshot().timelock.earliestExecution as string) +
              3_600_000,
          ).toISOString(),
          delaySeconds: 172_800,
          blockNumber: 1,
        },
      },
    });
    render(<TimelockExecutionReview snapshot={snapshot} />);

    expect(screen.getByTestId('timelock-execute-button')).toBeDisabled();
    expect(screen.getByTestId('timelock-readiness')).toHaveAttribute(
      'data-ready',
      'false',
    );
  });

  it('disables execution when the proposal is not queued', () => {
    const snapshot = makeGovernedChangeSnapshot({ input: { proposal: null } });
    render(<TimelockExecutionReview snapshot={snapshot} />);

    expect(screen.getByTestId('timelock-execute-button')).toBeDisabled();
    expect(screen.getByTestId('timelock-proposal-id')).toHaveTextContent('—');
  });

  it('revalidates authority at action time and blocks a changed account', () => {
    const onExecute = jest.fn();
    const snapshot = makeGovernedChangeSnapshot();
    render(
      <TimelockExecutionReview
        snapshot={snapshot}
        onExecute={onExecute}
        revalidatedAuthority={{
          account: '0x0000000000000000000000000000000000000001',
          chainId: REQUIRED_CHAIN,
          authorized: true,
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('timelock-execute-button'));

    expect(onExecute).not.toHaveBeenCalled();
    expect(screen.getByTestId('timelock-authority-rejected')).toBeInTheDocument();
    expect(screen.getByText(/account changed since review/i)).toBeInTheDocument();
  });

  it('renders a reorg alert instead of the status badge when execution was reorged', () => {
    const snapshot = makeGovernedChangeSnapshot({
      input: { execution: { status: 'reorged', txHash: '0xdead' as `0x${string}` } },
    });
    render(<TimelockExecutionReview snapshot={snapshot} />);

    expect(screen.getByTestId('timelock-execution-reorged')).toBeInTheDocument();
    expect(
      screen.queryByTestId('timelock-execution-status'),
    ).not.toBeInTheDocument();
  });

  it('keeps execution disabled and shows blocking reasons on an unsupported chain', () => {
    const snapshot = makeGovernedChangeSnapshot({
      input: { currentChainId: 1 },
    });
    render(<TimelockExecutionReview snapshot={snapshot} />);

    expect(screen.getByTestId('timelock-execute-button')).toBeDisabled();
    expect(
      screen.getByTestId('timelock-execution-blocked'),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
