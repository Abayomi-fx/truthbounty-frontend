import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Keep keyboard focus in an open dialog and return it to its trigger on close. */
export function useDialogFocus<T extends HTMLElement>(
  open: boolean,
  dialogRef: RefObject<T | null>,
  initialFocusRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !dialogRef.current) return;

    const dialog = dialogRef.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) =>
          !element.matches(':disabled') &&
          !element.closest('[hidden], [inert], [aria-hidden="true"]'),
      );
    const focusFirst = () => {
      const items = focusable();
      const preferred = initialFocusRef.current;
      (preferred && items.includes(preferred) ? preferred : items[0] ?? dialog).focus();
    };
    const isTopmost = () => {
      const dialogs = document.querySelectorAll('[aria-modal="true"]');
      return dialogs[dialogs.length - 1] === dialog;
    };
    const isWalletModalEvent = (event: Event) =>
      event.composedPath().some(
        (target) =>
          target instanceof Element &&
          target.matches('w3m-modal, wcm-modal'),
      );

    focusFirst();

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopmost() || isWalletModalEvent(event)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (active === dialog || !dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (!isTopmost() || isWalletModalEvent(event)) return;
      if (!dialog.contains(event.target as Node)) focusFirst();
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocus);
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open, dialogRef, initialFocusRef]);
}
