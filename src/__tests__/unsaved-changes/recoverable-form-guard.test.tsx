/**
 * UI-FE-084 — recoverable form guard integration tests.
 *
 * Exercises the reusable boundary end-to-end with a harness form:
 * refresh/back unload, internal navigation, account/chain switch, successful
 * save, failed save, draft restore, and discard.
 */

import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { useRecoverableFormDraft } from '@/hooks/useRecoverableFormDraft';
import { useUnsavedChangesDialog } from '@/hooks/useUnsavedChangesDialog';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { UnsavedChangesDialog } from '@/components/ui/UnsavedChangesDialog';
import { DraftStatusIndicator } from '@/components/ui/DraftStatusIndicator';
import {
  saveLocalDraft,
  type DraftScope,
} from '@/lib/drafts/recoverable-draft';

const SCOPE: DraftScope = {
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  chainId: 10,
  releaseId: 'v2.0.0-sepolia',
};

interface Payload {
  value: string;
}

const isPayload = (value: unknown): value is Payload =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { value?: unknown }).value === 'string';

interface HarnessProps {
  scope?: DraftScope;
  formId?: string;
  onSave?: () => Promise<boolean>;
  onNavigate?: (href: string) => void;
}

function Harness({
  scope = SCOPE,
  formId = 'harness',
  onSave = async () => true,
  onNavigate = () => {},
}: HarnessProps) {
  const [value, setValue] = useState('');
  const [persisted, setPersisted] = useState(false);
  const isDirty = value.trim().length > 0 && !persisted;

  const draft = useRecoverableFormDraft<Payload>({
    formId,
    scope,
    payload: { value },
    isDirty,
    validatePayload: isPayload,
    autosave: false,
  });
  const guardDialog = useUnsavedChangesDialog({ onSaveDraft: draft.saveDraft });

  useUnsavedChangesGuard({ when: isDirty, confirm: guardDialog.confirm, navigate: onNavigate });

  const handleSave = async () => {
    const ok = await onSave();
    if (ok) {
      // Verified persistence — clear the draft and release the guard.
      draft.markPersisted();
      setPersisted(true);
    }
  };

  return (
    <div>
      <label htmlFor="statement">Statement</label>
      <input
        id="statement"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <DraftStatusIndicator status={draft.status} lastSavedAt={draft.lastSavedAt} />
      {draft.hasRestoredDraft && draft.restoredPayload ? (
        <button
          type="button"
          onClick={() => {
            setValue(draft.restoredPayload!.value);
            draft.acknowledgeRestoredDraft();
          }}
        >
          Restore draft
        </button>
      ) : null}
      <button type="button" onClick={() => draft.saveDraft()}>
        Save draft locally
      </button>
      <button
        type="button"
        onClick={() => {
          draft.discardDraft();
          setValue('');
        }}
      >
        Discard draft
      </button>
      <button type="button" onClick={handleSave}>
        Save
      </button>
      <a href="/claims/new">Leave</a>

      <UnsavedChangesDialog
        open={guardDialog.isConfirmOpen}
        onConfirmLeave={() => {
          draft.discardDraft();
          guardDialog.confirmLeave();
        }}
        onCancel={guardDialog.cancelLeave}
        onSaveDraft={guardDialog.saveDraftAndLeave}
      />
    </div>
  );
}

function typeStatement(text: string) {
  fireEvent.change(screen.getByLabelText('Statement'), { target: { value: text } });
}

function dispatchUnload(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('refresh / back unload protection', () => {
  it('blocks an unload while nontrivial input is unsaved', () => {
    render(<Harness />);
    typeStatement('a claim statement');
    expect(dispatchUnload()).toBe(true);
  });

  it('does not block when there is no input', () => {
    render(<Harness />);
    expect(dispatchUnload()).toBe(false);
  });
});

describe('internal navigation', () => {
  it('asks before leaving and stays when the user declines', async () => {
    const onNavigate = jest.fn();
    render(<Harness onNavigate={onNavigate} />);
    typeStatement('unsaved words');

    fireEvent.click(screen.getByText('Leave'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /stay editing/i }));

    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Statement')).toHaveValue('unsaved words');
  });

  it('navigates when the user chooses to discard and leave', async () => {
    const onNavigate = jest.fn();
    render(<Harness onNavigate={onNavigate} />);
    typeStatement('unsaved words');

    fireEvent.click(screen.getByText('Leave'));
    fireEvent.click(screen.getByRole('button', { name: /discard and leave/i }));

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/claims/new'),
    ));
    expect(localStorage.getItem('truthbounty:form-draft:harness')).toBeNull();
  });
});

describe('successful save', () => {
  it('clears the draft and releases the guard after verified persistence', async () => {
    render(<Harness onSave={async () => true} />);
    typeStatement('will be saved');
    // Persist a local draft first so we can prove it is cleared.
    fireEvent.click(screen.getByRole('button', { name: /save draft locally/i }));
    expect(localStorage.getItem('truthbounty:form-draft:harness')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByTestId('draft-status-persisted')).toBeInTheDocument());
    expect(localStorage.getItem('truthbounty:form-draft:harness')).toBeNull();
    expect(dispatchUnload()).toBe(false);
  });
});

describe('failed save', () => {
  it('keeps the draft and the guard when persistence fails', async () => {
    render(<Harness onSave={async () => false} />);
    typeStatement('cannot be saved yet');
    fireEvent.click(screen.getByRole('button', { name: /save draft locally/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Statement')).toHaveValue('cannot be saved yet'),
    );
    expect(screen.queryByTestId('draft-status-persisted')).not.toBeInTheDocument();
    expect(localStorage.getItem('truthbounty:form-draft:harness')).not.toBeNull();
    expect(dispatchUnload()).toBe(true);
  });
});

describe('draft restore', () => {
  it('offers an explicit restore of a compatible local draft', () => {
    saveLocalDraft('harness', SCOPE, { value: 'recovered statement' }, isPayload);
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: /restore draft/i }));
    expect(screen.getByLabelText('Statement')).toHaveValue('recovered statement');
  });

  it('reports local persistence distinctly from canonical persistence', () => {
    render(<Harness />);
    typeStatement('local only');
    fireEvent.click(screen.getByRole('button', { name: /save draft locally/i }));
    expect(screen.getByTestId('draft-status-local')).toHaveTextContent(/local draft/i);
    expect(screen.queryByTestId('draft-status-persisted')).not.toBeInTheDocument();
  });
});

describe('discard', () => {
  it('clears storage and releases the guard on explicit discard', () => {
    render(<Harness />);
    typeStatement('throw it away');
    fireEvent.click(screen.getByRole('button', { name: /save draft locally/i }));
    expect(localStorage.getItem('truthbounty:form-draft:harness')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /discard draft/i }));

    expect(localStorage.getItem('truthbounty:form-draft:harness')).toBeNull();
    expect(screen.getByTestId('draft-status-clean')).toBeInTheDocument();
    expect(dispatchUnload()).toBe(false);
  });
});

describe('account / chain / release switch', () => {
  it('quarantines a draft authored under another account', async () => {
    const { rerender } = render(<Harness />);
    typeStatement('scoped to account A');
    fireEvent.click(screen.getByRole('button', { name: /save draft locally/i }));
    expect(localStorage.getItem('truthbounty:form-draft:harness')).not.toBeNull();

    const otherAccount: DraftScope = {
      ...SCOPE,
      address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    };
    rerender(<Harness scope={otherAccount} />);

    await waitFor(() =>
      expect(screen.getByTestId('draft-status-quarantined')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: /restore draft/i })).not.toBeInTheDocument();
  });
});
