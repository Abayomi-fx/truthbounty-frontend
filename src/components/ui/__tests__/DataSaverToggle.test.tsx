import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReducedDataProvider } from '@/components/providers/ReducedDataProvider';
import { DataSaverToggle } from '../DataSaverToggle';
import { assertAccessible } from '@/__tests__/utils/axe';

function renderWithMode(initialMode: 'auto' | 'on' | 'off') {
  return render(
    <ReducedDataProvider initialMode={initialMode}>
      <DataSaverToggle />
    </ReducedDataProvider>,
  );
}

describe('DataSaverToggle (UI-FE-082)', () => {
  it('is not pressed when data saving is off', () => {
    renderWithMode('off');
    const toggle = screen.getByTestId('data-saver-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveAttribute('data-mode', 'off');
  });

  it('is pressed when the user forces data saving on', () => {
    renderWithMode('on');
    const toggle = screen.getByTestId('data-saver-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAttribute('data-source', 'forced-on');
  });

  it('reflects a constrained connection in auto mode', () => {
    render(
      <ReducedDataProvider network={{ saveData: true, effectiveType: '2g' }}>
        <DataSaverToggle />
      </ReducedDataProvider>,
    );
    const toggle = screen.getByTestId('data-saver-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAttribute('data-mode', 'auto');
  });

  it('toggles state on click and updates aria-pressed', async () => {
    const user = userEvent.setup();
    renderWithMode('off');
    const toggle = screen.getByTestId('data-saver-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);
    expect(screen.getByTestId('data-saver-toggle')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('data-saver-toggle')).toHaveAttribute('data-mode', 'on');

    await user.click(screen.getByTestId('data-saver-toggle'));
    expect(screen.getByTestId('data-saver-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('data-saver-toggle')).toHaveAttribute('data-mode', 'off');
  });

  it('has an accessible name describing the current state', () => {
    renderWithMode('on');
    expect(
      screen.getByRole('button', { name: /data saver is on/i }),
    ).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = renderWithMode('on');
    await assertAccessible(container);
  });
});
