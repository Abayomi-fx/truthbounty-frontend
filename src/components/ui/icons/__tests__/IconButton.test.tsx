/**
 * UI-FE-089 — `IconButton` accessibility contract.
 *
 * Icon-only controls must expose an accessible name, render their glyph
 * decoratively, and remain keyboard/axe clean.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { assertAccessible } from '@/__tests__/utils/axe';
import { IconButton, type IconButtonProps } from '@/components/ui/icons';

describe('IconButton', () => {
  it('uses the required label as the accessible name', () => {
    render(<IconButton name="x" label="Close dialog" />);
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();
  });

  it('renders the glyph decoratively', () => {
    const { container } = render(<IconButton name="copy" label="Copy value" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('is keyboard operable', async () => {
    const onActivate = jest.fn();
    render(<IconButton name="refresh" label="Refresh" onClick={onActivate} />);
    const button = screen.getByRole('button', { name: 'Refresh' });
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('is axe-clean in every variant and state', async () => {
    const { container } = render(
      <div>
        <IconButton name="settings" label="Settings" variant="ghost" />
        <IconButton name="plus" label="Add item" variant="solid" />
        <IconButton name="download" label="Download" variant="outline" />
        <IconButton name="ban" label="Blocked" disabled />
      </div>,
    );
    await assertAccessible(container);
  });

  it('rejects a control without an accessible name at the type level', () => {
    // @ts-expect-error icon-only controls require a label
    const _invalid: IconButtonProps = { name: 'x' };
    expect(_invalid).toBeDefined();
  });
});
