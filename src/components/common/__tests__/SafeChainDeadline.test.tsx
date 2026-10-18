import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { SafeChainDeadline } from '../SafeChainDeadline';

describe('SafeChainDeadline', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T12:00:00Z').getTime());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockAnchor = {
    anchorBlockNumber: 1000n,
    anchorBlockTimestampMs: new Date('2024-01-01T11:00:00Z').getTime(),
    avgBlockSeconds: 2,
  };

  it('renders loading state', () => {
    render(<SafeChainDeadline anchor={mockAnchor} targetBlockNumber={1500n} dataState="loading" />);
    expect(screen.getByText('Calculating deadline...')).toBeInTheDocument();
  });

  it('renders pending state', () => {
    render(<SafeChainDeadline anchor={mockAnchor} targetBlockNumber={1500n} dataState="pending" />);
    expect(screen.getByText('Pending confirmation...')).toBeInTheDocument();
  });

  it('renders failed state', () => {
    render(<SafeChainDeadline anchor={mockAnchor} targetBlockNumber={1500n} dataState="failed" />);
    expect(screen.getByText('Deadline calculation failed')).toBeInTheDocument();
  });

  it('renders rejected state', () => {
    render(<SafeChainDeadline anchor={mockAnchor} targetBlockNumber={1500n} dataState="rejected" />);
    expect(screen.getByText('Chain projection rejected')).toBeInTheDocument();
  });

  it('renders reorged state', () => {
    render(<SafeChainDeadline anchor={mockAnchor} targetBlockNumber={1500n} dataState="reorged" />);
    expect(screen.getByText('Chain reorg detected, recalculating...')).toBeInTheDocument();
  });

  it('renders empty fallback when dataState is empty', () => {
    render(<SafeChainDeadline anchor={mockAnchor} targetBlockNumber={1500n} dataState="empty" fallbackText="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renders active deadline correctly', () => {
    const targetBlockNumber = 4600n; // 3600 blocks ahead -> 7200 seconds -> 2 hours from anchor (1 hour in future of system time)
    const { container } = render(<SafeChainDeadline anchor={mockAnchor} targetBlockNumber={targetBlockNumber} dataState="confirmed" />);
    expect(container.querySelector('time')).toBeInTheDocument();
    expect(screen.queryByText('Expired')).not.toBeInTheDocument();
  });

  it('renders expired state when deadline is past', () => {
    const targetBlockNumber = 1000n; // same block as anchor -> deadline is 11:00:00Z
    // System time is 12:00:00Z, so it's expired
    render(<SafeChainDeadline anchor={mockAnchor} targetBlockNumber={targetBlockNumber} dataState="confirmed" />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('shows stale indicator when dataState is stale', () => {
    const { container } = render(
      <SafeChainDeadline anchor={mockAnchor} targetBlockNumber={2800n} dataState="stale" />
    );
    expect(screen.getByLabelText('Stale data')).toBeInTheDocument();
  });
});
