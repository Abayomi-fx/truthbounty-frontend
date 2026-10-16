import { useRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useDialogFocus } from '../useDialogFocus';

function DialogHarness() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(open, dialogRef, firstRef, () => setOpen(false));

  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <button>Outside</button>
      {open && (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Example" tabIndex={-1}>
          <button ref={firstRef}>First</button>
          <button>Last</button>
          <button disabled>Unavailable</button>
        </div>
      )}
    </>
  );
}

describe('useDialogFocus', () => {
  it('moves focus inside, cycles past disabled controls, and returns focus on Escape', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(trigger);

    const first = screen.getByRole('button', { name: 'First' });
    const last = screen.getByRole('button', { name: 'Last' });
    expect(first).toHaveFocus();

    await user.tab({ shift: true });
    expect(last).toHaveFocus();
    let wrappedFromLast = false;
    document.addEventListener('keydown', (event) => {
      wrappedFromLast = event.defaultPrevented;
    }, { once: true });
    await user.tab();
    expect(first).toHaveFocus();
    expect(wrappedFromLast).toBe(true);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('keeps programmatic focus from leaving the dialog', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    screen.getByRole('button', { name: 'Outside' }).focus();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('cycles backward from the dialog container to its last control', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));

    screen.getByRole('dialog').focus();
    await user.tab({ shift: true });

    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
  });

  it('allows focus and Escape within the wallet modal', async () => {
    const user = userEvent.setup();
    const walletModal = document.createElement('w3m-modal');
    const walletButton = document.createElement('button');
    walletModal.attachShadow({ mode: 'open' }).append(walletButton);
    document.body.append(walletModal);
    try {
      render(<DialogHarness />);
      await user.click(screen.getByRole('button', { name: 'Open dialog' }));

      walletButton.focus();
      expect(walletModal.shadowRoot?.activeElement).toBe(walletButton);
      await user.keyboard('{Escape}');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    } finally {
      walletModal.remove();
    }
  });
});
