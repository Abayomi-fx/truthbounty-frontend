import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReducedDataProvider } from '@/components/providers/ReducedDataProvider';
import { useAdaptivePolling, useReducedData } from '@/hooks/useReducedData';
import { DeferredMedia } from '@/components/ui/DeferredMedia';
import { SyncFreshnessBadge } from '@/components/ui/SyncFreshnessBadge';

/**
 * UI-FE-082 integration: a claim-detail-like surface running on a constrained
 * network must (1) stop auto-fetching rich media, (2) stretch non-critical
 * polling, (3) never touch protocol-critical polling, and (4) tell the user how
 * fresh the data is and let them refresh on demand.
 */

const LAST_SYNCED = Date.parse('2026-06-01T11:58:00.000Z');
const NOW = Date.parse('2026-06-01T12:00:00.000Z');

function ClaimSurface() {
  const { isReducedData, getPollInterval } = useReducedData();
  const nonCritical = useAdaptivePolling({ baseIntervalMs: 30_000, critical: false });
  const critical = useAdaptivePolling({ baseIntervalMs: 15_000, critical: true });

  return (
    <section>
      <DeferredMedia src="/ipfs/evidence-1.jpg" alt="Evidence image 1" />
      <SyncFreshnessBadge
        lastSyncedAt={LAST_SYNCED}
        now={NOW}
        isDeferred={nonCritical.isDeferred}
        onRefresh={() => undefined}
        label="claims"
      />
      <output data-testid="non-critical-interval">{String(nonCritical.pollInterval)}</output>
      <output data-testid="critical-interval">{String(critical.pollInterval)}</output>
      <output data-testid="reduced-flag">{String(isReducedData)}</output>
      <output data-testid="direct-non-critical">{String(getPollInterval(30_000, { critical: false }))}</output>
    </section>
  );
}

describe('reduced-data on a constrained network (UI-FE-082)', () => {
  it('defers media, stretches non-critical polling and preserves critical polling', () => {
    render(
      <ReducedDataProvider network={{ saveData: true, effectiveType: 'slow-2g' }}>
        <ClaimSurface />
      </ReducedDataProvider>,
    );

    // (1) No <img> is emitted, so the browser never requests the asset.
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByTestId('deferred-media-placeholder')).toBeInTheDocument();

    // (2) Non-critical polling is stretched 4x.
    expect(screen.getByTestId('non-critical-interval')).toHaveTextContent('120000');
    expect(screen.getByTestId('direct-non-critical')).toHaveTextContent('120000');

    // (3) Protocol-critical polling is byte-for-byte unchanged.
    expect(screen.getByTestId('critical-interval')).toHaveTextContent('15000');

    // (4) Freshness is still communicated and refresh remains available.
    expect(screen.getByTestId('reduced-flag')).toHaveTextContent('true');
    expect(screen.getByTestId('sync-freshness-badge')).toHaveTextContent(/last synced 2m ago/i);
    expect(screen.getByTestId('sync-freshness-refresh')).toBeInTheDocument();
  });

  it('lets the user opt out and immediately restores full-fidelity behaviour', async () => {
    function OptOut() {
      const { toggle, isReducedData } = useReducedData();
      return (
        <button type="button" onClick={toggle}>
          {isReducedData ? 'disable' : 'enable'} data saver
        </button>
      );
    }

    const user = userEvent.setup();
    render(
      <ReducedDataProvider network={{ saveData: true, effectiveType: '2g' }}>
        <ClaimSurface />
        <OptOut />
      </ReducedDataProvider>,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /disable data saver/i }));

    // Media loads again and polling returns to the caller-provided cadence...
    expect(screen.getByRole('img')).toHaveAttribute('src', '/ipfs/evidence-1.jpg');
    expect(screen.getByTestId('non-critical-interval')).toHaveTextContent('30000');
    // ...while critical polling was never affected either way.
    expect(screen.getByTestId('critical-interval')).toHaveTextContent('15000');
  });
});
