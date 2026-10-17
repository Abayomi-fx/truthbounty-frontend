/**
 * UI-FE-084 — UnsavedChangesDialog tests.
 *
 * Verifies role/name/description wiring, safe initial focus, Escape/backdrop
 * behaviour (stay), explicit leave, optional save-draft action, and axe.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { assertAccessible } from '@/__tests__/utils/axe';

import { UnsavedChangesDialog } from '../UnsavedChangesDialog';

function setup(overrides: Partial<React.ComponentProps<typeof UnsavedChangesDialog>> = {}) {
  const onConfirmLeave = jest.fn();
  const onCancel = jest.fn();
  const onSaveDraft = jest.fn();
  const utils = render(
    <UnsavedChangesDialog
      open
      onConfirmLeave={onConfirmLeave}
      onCancel={onCancel}
      onSaveDraft={onSaveDraft}
      {...overrides}
    />,
  );
  return { ...utils, onConfirmLeave, onCancel, onSaveDraft };
}

describe('UnsavedChangesDialog', () => {
  it('renders an accessible labelled/described modal', () => {
    setup();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'unsaved-changes-title');
    expect(dialog).toHaveAttribute('aria-describedby');
    expect(
      screen.getByRole('heading', { name: /unsaved changes/i }),
    ).toBeInTheDocument();
  });

  it('states that drafts are local, not server/on-chain', () => {
    setup();
    expect(screen.getByText(/only in this browser/i)).toBeInTheDocument();
    expect(screen.getByText(/on-chain/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    setup({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves initial focus to the safe "stay" action', () => {
    setup();
    expect(screen.getByRole('button', { name: /stay editing/i })).toHaveFocus();
  });

  it('treats Escape as stay, never discard', () => {
    const { onCancel, onConfirmLeave } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirmLeave).not.toHaveBeenCalled();
  });

  it('leaves only on explicit confirmation', async () => {
    const user = userEvent.setup();
    const { onConfirmLeave } = setup();
    await user.click(screen.getByRole('button', { name: /discard and leave/i }));
    expect(onConfirmLeave).toHaveBeenCalledTimes(1);
  });

  it('cancels from the stay action', async () => {
    const user = userEvent.setup();
    const { onCancel } = setup();
    await user.click(screen.getByRole('button', { name: /stay editing/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('offers a save-draft action when a handler is provided', async () => {
    const user = userEvent.setup();
    const { onSaveDraft } = setup();
    await user.click(screen.getByRole('button', { name: /save draft/i }));
    expect(onSaveDraft).toHaveBeenCalledTimes(1);
  });

  it('hides the save-draft action when no handler is provided', () => {
    setup({ onSaveDraft: null });
    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = setup();
    await assertAccessible(container);
  });
});
