/**
 * UI-FE-084 — unsaved-changes dialog accessibility.
 *
 * Keyboard and screen-reader behaviour for the guard confirmation:
 * accessible name/description, focus trap, Escape-as-stay, and axe.
 */

import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { assertAccessible } from '../utils/axe';

import { UnsavedChangesDialog } from '@/components/ui/UnsavedChangesDialog';

afterEach(() => {
  cleanup();
});

function renderDialog() {
  const onConfirmLeave = jest.fn();
  const onCancel = jest.fn();
  const onSaveDraft = jest.fn();
  const utils = render(
    <UnsavedChangesDialog
      open
      onConfirmLeave={onConfirmLeave}
      onCancel={onCancel}
      onSaveDraft={onSaveDraft}
    />,
  );
  return { ...utils, onConfirmLeave, onCancel, onSaveDraft };
}

describe('Accessibility: unsaved-changes dialog', () => {
  it('exposes a labelled, described modal dialog', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(/unsaved changes/i);
    expect(dialog).toHaveAccessibleDescription(/discard/i);
  });

  it('has no axe violations', async () => {
    const { container } = renderDialog();
    await assertAccessible(container);
  });

  it('starts on the safe action and cycles focus within the dialog', async () => {
    const user = userEvent.setup();
    renderDialog();

    const stay = screen.getByRole('button', { name: /stay editing/i });
    const saveDraft = screen.getByRole('button', { name: /save draft/i });
    const leave = screen.getByRole('button', { name: /discard and leave/i });

    expect(stay).toHaveFocus();

    await user.tab();
    expect(saveDraft).toHaveFocus();

    await user.tab();
    expect(leave).toHaveFocus();

    // Wraps back to the first control — focus never escapes the dialog.
    await user.tab();
    expect(stay).toHaveFocus();

    await user.tab({ shift: true });
    expect(leave).toHaveFocus();
  });

  it('treats Escape as stay, never discard', () => {
    const { onCancel, onConfirmLeave } = renderDialog();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirmLeave).not.toHaveBeenCalled();
  });
});
