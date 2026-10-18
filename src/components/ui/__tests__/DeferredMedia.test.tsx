import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReducedDataProvider } from '@/components/providers/ReducedDataProvider';
import { DeferredMedia } from '../DeferredMedia';
import { useReducedData } from '@/hooks/useReducedData';
import { assertAccessible } from '@/__tests__/utils/axe';

function renderStandard(ui: React.ReactElement) {
  return render(<ReducedDataProvider initialMode="off">{ui}</ReducedDataProvider>);
}

function renderReduced(ui: React.ReactElement) {
  return render(<ReducedDataProvider initialMode="on">{ui}</ReducedDataProvider>);
}

describe('DeferredMedia (UI-FE-082)', () => {
  it('renders a normal lazy image when data saving is off', () => {
    renderStandard(<DeferredMedia src="/evidence.jpg" alt="Evidence 1" />);
    const img = screen.getByTestId('deferred-media-image');
    expect(img).toHaveAttribute('src', '/evidence.jpg');
    expect(img).toHaveAttribute('alt', 'Evidence 1');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(screen.queryByTestId('deferred-media-placeholder')).not.toBeInTheDocument();
  });

  it('does not fetch the asset under reduced-data mode', () => {
    renderReduced(<DeferredMedia src="/heavy.jpg" alt="Heavy evidence" />);
    expect(screen.getByTestId('deferred-media-placeholder')).toBeInTheDocument();
    // The critical assertion: no <img> means no network request for the asset.
    expect(screen.queryByTestId('deferred-media-image')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('loads the asset on explicit click', async () => {
    const user = userEvent.setup();
    renderReduced(<DeferredMedia src="/heavy.jpg" alt="Heavy evidence" />);

    await user.click(screen.getByTestId('deferred-media-placeholder'));

    const img = screen.getByTestId('deferred-media-image');
    expect(img).toHaveAttribute('src', '/heavy.jpg');
    expect(screen.queryByTestId('deferred-media-placeholder')).not.toBeInTheDocument();
  });

  it('is keyboard operable via Enter/Space', async () => {
    const user = userEvent.setup();
    renderReduced(<DeferredMedia src="/heavy.jpg" alt="Heavy evidence" />);

    await user.tab();
    expect(screen.getByTestId('deferred-media-placeholder')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('deferred-media-image')).toBeInTheDocument();
  });

  it('surfaces a fail-closed error state when the image fails to load', () => {
    const onError = jest.fn();
    renderStandard(<DeferredMedia src="/broken.jpg" alt="Broken" onError={onError} />);

    fireEvent.error(screen.getByTestId('deferred-media-image'));

    expect(onError).toHaveBeenCalledTimes(1);
    const error = screen.getByTestId('deferred-media-error');
    expect(error).toHaveAttribute('role', 'note');
    expect(error).toHaveTextContent(/image unavailable/i);
  });

  it('stops deferring when data saving is turned off after mount', async () => {
    function Controls() {
      const { setMode } = useReducedData();
      return (
        <button type="button" onClick={() => setMode('off')}>
          turn off data saver
        </button>
      );
    }

    const user = userEvent.setup();
    render(
      <ReducedDataProvider initialMode="on">
        <DeferredMedia src="/heavy.jpg" alt="Heavy" />
        <Controls />
      </ReducedDataProvider>,
    );
    expect(screen.getByTestId('deferred-media-placeholder')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /turn off data saver/i }));

    expect(screen.getByTestId('deferred-media-image')).toBeInTheDocument();
    expect(screen.queryByTestId('deferred-media-placeholder')).not.toBeInTheDocument();
  });

  it('has no axe violations in the deferred state', async () => {
    const { container } = renderReduced(<DeferredMedia src="/heavy.jpg" alt="Heavy evidence" />);
    await assertAccessible(container);
  });
});
