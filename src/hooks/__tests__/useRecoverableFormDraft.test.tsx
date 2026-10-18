/**
 * UI-FE-084 — useRecoverableFormDraft tests.
 *
 * Covers autosave, explicit restore, discard, verified-persistence clearing,
 * failed saves, and account/chain/release quarantine.
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { useRecoverableFormDraft } from '../useRecoverableFormDraft';
import {
  saveLocalDraft,
  readQuarantinedDraft,
  type DraftScope,
} from '@/lib/drafts/recoverable-draft';

const SCOPE: DraftScope = {
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  chainId: 10,
  releaseId: 'v2.0.0-sepolia',
};

interface Payload {
  reason: string;
}

const isPayload = (value: unknown): value is Payload =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { reason?: unknown }).reason === 'string';

const FORM_ID = 'dispute:1';

type Options = Parameters<typeof useRecoverableFormDraft<Payload>>[0];

function baseOptions(overrides: Partial<Options> = {}): Options {
  return {
    formId: FORM_ID,
    scope: SCOPE,
    payload: { reason: '' },
    isDirty: false,
    validatePayload: isPayload,
    autosaveDelayMs: 500,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('autosave', () => {
  it('writes a local draft after the debounce and reports saved-local', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() =>
      useRecoverableFormDraft(baseOptions({ payload: { reason: 'draft text' }, isDirty: true })),
    );

    expect(result.current.status).toBe('dirty');

    act(() => {
      jest.advanceTimersByTime(500);
    });

    await waitFor(() => expect(result.current.status).toBe('saved-local'));
    expect(localStorage.getItem(`truthbounty:form-draft:${FORM_ID}`)).not.toBeNull();
    expect(result.current.lastSavedAt).toEqual(expect.any(Number));
  });

  it('reports save-failed and keeps the guard data when storage throws', async () => {
    jest.useFakeTimers();
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() =>
      useRecoverableFormDraft(baseOptions({ payload: { reason: 'draft text' }, isDirty: true })),
    );

    act(() => {
      jest.advanceTimersByTime(500);
    });

    await waitFor(() => expect(result.current.status).toBe('save-failed'));
  });
});

describe('restore', () => {
  it('surfaces a compatible stored draft without applying it silently', () => {
    saveLocalDraft(FORM_ID, SCOPE, { reason: 'recovered' }, isPayload);

    const { result } = renderHook(() => useRecoverableFormDraft(baseOptions()));

    expect(result.current.hasRestoredDraft).toBe(true);
    expect(result.current.restoredPayload).toEqual({ reason: 'recovered' });
    expect(result.current.status).toBe('saved-local');
  });

  it('acknowledges and clears the restore notice', () => {
    saveLocalDraft(FORM_ID, SCOPE, { reason: 'recovered' }, isPayload);
    const { result } = renderHook(() => useRecoverableFormDraft(baseOptions()));

    act(() => result.current.acknowledgeRestoredDraft());

    expect(result.current.hasRestoredDraft).toBe(false);
    // The draft remains stored for the caller to restore or discard.
    expect(localStorage.getItem(`truthbounty:form-draft:${FORM_ID}`)).not.toBeNull();
  });
});

describe('quarantine on scope change', () => {
  it('quarantines a draft saved under a different account', () => {
    saveLocalDraft(
      FORM_ID,
      { ...SCOPE, address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' },
      { reason: 'other' },
      isPayload,
    );

    const { result } = renderHook(() => useRecoverableFormDraft(baseOptions()));

    expect(result.current.status).toBe('quarantined');
    expect(result.current.quarantined).toBe(true);
    expect(result.current.quarantinedReason).toBe('account-change');
    expect(result.current.restoredPayload).toBeNull();
  });

  it('quarantines when the account switches mid-edit', async () => {
    saveLocalDraft(FORM_ID, SCOPE, { reason: 'mine' }, isPayload);

    const { result, rerender } = renderHook(
      (props: { options: Options }) => useRecoverableFormDraft(props.options),
      { initialProps: { options: baseOptions() } },
    );
    expect(result.current.hasRestoredDraft).toBe(true);

    const otherAccount: DraftScope = {
      ...SCOPE,
      address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    };
    rerender({
      options: baseOptions({ scope: otherAccount, payload: { reason: 'mine' }, isDirty: true }),
    });

    await waitFor(() => expect(result.current.status).toBe('quarantined'));
    expect(result.current.restoredPayload).toBeNull();
    expect(readQuarantinedDraft(FORM_ID)?.reason).toBe('account-change');
  });

  it('acknowledging a quarantine drops the quarantined record', async () => {
    saveLocalDraft(FORM_ID, { ...SCOPE, chainId: 11155420 }, { reason: 'x' }, isPayload);
    const { result } = renderHook(() => useRecoverableFormDraft(baseOptions()));
    expect(result.current.quarantined).toBe(true);

    act(() => result.current.acknowledgeQuarantine());
    await waitFor(() => expect(result.current.quarantined).toBe(false));
    expect(readQuarantinedDraft(FORM_ID)).toBeNull();
  });
});

describe('discard and verified persistence', () => {
  it('discardDraft clears storage and resets to clean', () => {
    saveLocalDraft(FORM_ID, SCOPE, { reason: 'x' }, isPayload);
    const { result } = renderHook(() => useRecoverableFormDraft(baseOptions()));

    act(() => result.current.discardDraft());

    expect(result.current.status).toBe('clean');
    expect(localStorage.getItem(`truthbounty:form-draft:${FORM_ID}`)).toBeNull();
  });

  it('markPersisted clears the draft and reports persisted', () => {
    saveLocalDraft(FORM_ID, SCOPE, { reason: 'x' }, isPayload);
    const { result } = renderHook(() =>
      useRecoverableFormDraft(baseOptions({ payload: { reason: 'x' }, isDirty: true })),
    );

    act(() => result.current.markPersisted());

    expect(result.current.status).toBe('persisted');
    expect(localStorage.getItem(`truthbounty:form-draft:${FORM_ID}`)).toBeNull();
  });

  it('manual saveDraft returns true and persists', () => {
    const { result } = renderHook(() =>
      useRecoverableFormDraft(baseOptions({ payload: { reason: 'manual' }, isDirty: true })),
    );
    let saved = false;
    act(() => {
      saved = result.current.saveDraft();
    });
    expect(saved).toBe(true);
    expect(localStorage.getItem(`truthbounty:form-draft:${FORM_ID}`)).not.toBeNull();
  });
});
