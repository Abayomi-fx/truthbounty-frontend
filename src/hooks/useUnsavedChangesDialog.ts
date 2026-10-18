/**
 * UI-FE-084 — useUnsavedChangesDialog.
 *
 * Promise-based confirmation controller for the unsaved-changes dialog.
 * `confirm()` opens the dialog and resolves true only when the user
 * explicitly chooses to discard and leave; Escape, "Stay", and unmount all
 * resolve false (fail closed — navigation is never allowed by silence).
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseUnsavedChangesDialogResult {
  isConfirmOpen: boolean;
  /** Open the dialog; resolves true only on explicit "leave". */
  confirm: () => Promise<boolean>;
  confirmLeave: () => void;
  cancelLeave: () => void;
  saveDraftAndLeave: () => void;
}

export interface UseUnsavedChangesDialogOptions {
  /** Invoked when the user picks "save draft and leave" (optional). */
  onSaveDraft?: () => void;
}

export function useUnsavedChangesDialog(
  options: UseUnsavedChangesDialogOptions = {},
): UseUnsavedChangesDialogResult {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const pendingRef = useRef<((allowed: boolean) => void) | null>(null);
  const onSaveDraftRef = useRef(options.onSaveDraft);
  onSaveDraftRef.current = options.onSaveDraft;

  // If the component unmounts while the dialog is open, settle as "stay"
  // so no caller is left awaiting a promise forever.
  useEffect(
    () => () => {
      pendingRef.current?.(false);
      pendingRef.current = null;
    },
    [],
  );

  const confirm = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        // A second concurrent request settles the first as "stay".
        pendingRef.current?.(false);
        pendingRef.current = resolve;
        setIsConfirmOpen(true);
      }),
    [],
  );

  const settle = useCallback((allowed: boolean) => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    setIsConfirmOpen(false);
    pending?.(allowed);
  }, []);

  const confirmLeave = useCallback(() => settle(true), [settle]);
  const cancelLeave = useCallback(() => settle(false), [settle]);
  const saveDraftAndLeave = useCallback(() => {
    onSaveDraftRef.current?.();
    settle(true);
  }, [settle]);

  return { isConfirmOpen, confirm, confirmLeave, cancelLeave, saveDraftAndLeave };
}
