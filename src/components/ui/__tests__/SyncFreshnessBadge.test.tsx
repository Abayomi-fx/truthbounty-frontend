import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncFreshnessBadge } from '../SyncFreshnessBadge';
import { assertAccessible } from '@/__tests__/utils/axe';

const NOW = Date.parse('2026-06-01T12:00:00.000Z');

describe('SyncFreshnessBadge (UI-FE-082)', () => {
  it('announces the last-synced time in a polite live region', () => {
    render(<SyncFreshnessBadge lastSyncedAt={NOW - 60_000} now={NOW} label="claims" />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Last synced 1m ago');
  });

  it('reports when no sync has happened yet', () => {
    render(<SyncFreshnessBadge lastSyncedAt={null} now={NOW} />);
    expect(screen.getByRole('status')).toHaveTextContent(/last synced never/i);
  });

  it('explains that auto-refresh is paused with reduced data', () => {
    render(<SyncFreshnessBadge lastSyncedAt={NOW - 1_000} now={NOW} isDeferred />);
    const badge = screen.getByTestId('sync-freshness-badge');
    expect(badge).toHaveAttribute('data-deferred', 'true');
    expect(badge).toHaveTextContent(/auto-refresh paused to save data/i);
  });

  it('offers a keyboard-operable manual refresh control', async () => {
    const onRefresh = jest.fn();
    const user = userEvent.setup();
    render(
      <SyncFreshnessBadge lastSyncedAt={NOW - 1_000} now={NOW} onRefresh={onRefresh} label="claims" />,
    );

    const button = screen.getByTestId('sync-freshness-refresh');
    await user.click(button);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('exposes a busy state and disables the control while refreshing', () => {
    render(<SyncFreshnessBadge lastSyncedAt={NOW} now={NOW} onRefresh={jest.fn()} isRefreshing label="claims" />);
    const button = screen.getByTestId('sync-freshness-refresh');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAccessibleName(/refreshing claims/i);
  });

  it('omits the refresh control when no handler is supplied', () => {
    render(<SyncFreshnessBadge lastSyncedAt={NOW} now={NOW} />);
    expect(screen.queryByTestId('sync-freshness-refresh')).not.toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <SyncFreshnessBadge lastSyncedAt={NOW - 60_000} now={NOW} isDeferred onRefresh={jest.fn()} label="claims" />,
    );
    await assertAccessible(container);
  });
});
