/**
 * UI-FE-084 — useUnsavedChangesDialog controller tests.
 *
 * The confirmation promise must fail closed: only an explicit "leave"
 * resolves true. Cancel, a superseding request, and unmount resolve false.
 */

import { act, renderHook } from '@testing-library/react';

import { useUnsavedChangesDialog } from '../useUnsavedChangesDialog';

describe('useUnsavedChangesDialog', () => {
  it('resolves true only on explicit confirmLeave', async () => {
    const { result } = renderHook(() => useUnsavedChangesDialog());

    let promise!: Promise<boolean>;
    act(() => {
      promise = result.current.confirm();
    });
    expect(result.current.isConfirmOpen).toBe(true);

    act(() => result.current.confirmLeave());
    await expect(promise).resolves.toBe(true);
    expect(result.current.isConfirmOpen).toBe(false);
  });

  it('resolves false on cancel (fail closed)', async () => {
    const { result } = renderHook(() => useUnsavedChangesDialog());

    let promise!: Promise<boolean>;
    act(() => {
      promise = result.current.confirm();
    });
    act(() => result.current.cancelLeave());

    await expect(promise).resolves.toBe(false);
  });

  it('settles a superseded request as false', async () => {
    const { result } = renderHook(() => useUnsavedChangesDialog());

    let first!: Promise<boolean>;
    act(() => {
      first = result.current.confirm();
    });
    let second!: Promise<boolean>;
    act(() => {
      second = result.current.confirm();
    });

    await expect(first).resolves.toBe(false);

    act(() => result.current.confirmLeave());
    await expect(second).resolves.toBe(true);
  });

  it('invokes onSaveDraft and resolves true on saveDraftAndLeave', async () => {
    const onSaveDraft = jest.fn();
    const { result } = renderHook(() => useUnsavedChangesDialog({ onSaveDraft }));

    let promise!: Promise<boolean>;
    act(() => {
      promise = result.current.confirm();
    });
    act(() => result.current.saveDraftAndLeave());

    await expect(promise).resolves.toBe(true);
    expect(onSaveDraft).toHaveBeenCalledTimes(1);
  });

  it('resolves false if unmounted while open', async () => {
    const { result, unmount } = renderHook(() => useUnsavedChangesDialog());

    let promise!: Promise<boolean>;
    act(() => {
      promise = result.current.confirm();
    });
    unmount();

    await expect(promise).resolves.toBe(false);
  });
});
