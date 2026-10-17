/**
 * UI-FE-084 — recoverable-draft store tests.
 *
 * Covers local-only persistence, fail-closed validation of untrusted
 * browser state, and account/chain/release quarantine semantics.
 */

import {
  DRAFT_SCHEMA_VERSION,
  clearLocalDraft,
  clearQuarantinedDraft,
  draftScopesMatch,
  hasNontrivialContent,
  listDraftFormIds,
  loadLocalDraft,
  markDraftPersisted,
  quarantineIncompatibleDrafts,
  readLocalDraftPayload,
  readQuarantinedDraft,
  saveLocalDraft,
  type DraftScope,
} from '../recoverable-draft';

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

const FORM_ID = 'claim-statement';

beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

describe('saveLocalDraft', () => {
  it('persists a validated payload and marks it local', () => {
    const draft = saveLocalDraft(FORM_ID, SCOPE, { reason: 'hello' }, isPayload);
    expect(draft).not.toBeNull();
    expect(draft?.persistence).toBe('local');
    expect(draft?.schemaVersion).toBe(DRAFT_SCHEMA_VERSION);
    expect(draft?.payload).toEqual({ reason: 'hello' });

    const loaded = loadLocalDraft(FORM_ID, SCOPE);
    expect(loaded.status).toBe('restored');
  });

  it('rejects an invalid form id', () => {
    expect(saveLocalDraft('', SCOPE, { reason: 'x' }, isPayload)).toBeNull();
  });

  it('fails closed when the payload guard rejects untrusted data', () => {
    expect(saveLocalDraft(FORM_ID, SCOPE, { nope: 1 }, isPayload)).toBeNull();
    expect(loadLocalDraft(FORM_ID, SCOPE).status).toBe('none');
  });

  it('returns null when storage throws (quota/privacy mode)', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(saveLocalDraft(FORM_ID, SCOPE, { reason: 'x' }, isPayload)).toBeNull();
  });
});

describe('loadLocalDraft', () => {
  it('returns none when nothing is stored', () => {
    expect(loadLocalDraft(FORM_ID, SCOPE).status).toBe('none');
  });

  it('drops corrupt JSON', () => {
    localStorage.setItem(`truthbounty:form-draft:${FORM_ID}`, '{not json');
    const result = loadLocalDraft(FORM_ID, SCOPE);
    expect(result).toEqual({ status: 'rejected', reason: 'corrupt' });
    expect(localStorage.getItem(`truthbounty:form-draft:${FORM_ID}`)).toBeNull();
  });

  it('drops an unsupported schema version', () => {
    const draft = saveLocalDraft(FORM_ID, SCOPE, { reason: 'x' }, isPayload)!;
    localStorage.setItem(
      `truthbounty:form-draft:${FORM_ID}`,
      JSON.stringify({ ...draft, schemaVersion: 999 }),
    );
    expect(loadLocalDraft(FORM_ID, SCOPE)).toEqual({
      status: 'rejected',
      reason: 'unsupported-schema',
    });
  });

  it('drops drafts with an ambiguous scope', () => {
    const draft = saveLocalDraft(FORM_ID, SCOPE, { reason: 'x' }, isPayload)!;
    const corrupted = { ...draft, scope: { address: SCOPE.address, chainId: SCOPE.chainId } };
    localStorage.setItem(`truthbounty:form-draft:${FORM_ID}`, JSON.stringify(corrupted));
    expect(loadLocalDraft(FORM_ID, SCOPE)).toEqual({
      status: 'rejected',
      reason: 'corrupt',
    });
  });

  it('quarantines a draft authored for a different account', () => {
    saveLocalDraft(
      FORM_ID,
      { ...SCOPE, address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' },
      { reason: 'other-account' },
      isPayload,
    );
    const result = loadLocalDraft(FORM_ID, SCOPE);
    expect(result).toEqual({ status: 'quarantined', reason: 'account-change' });
    expect(localStorage.getItem(`truthbounty:form-draft:${FORM_ID}`)).toBeNull();
    const record = readQuarantinedDraft(FORM_ID);
    expect(record?.reason).toBe('account-change');
  });

  it('quarantines a draft authored on a different chain', () => {
    saveLocalDraft(FORM_ID, { ...SCOPE, chainId: 11155420 }, { reason: 'x' }, isPayload);
    expect(loadLocalDraft(FORM_ID, SCOPE)).toEqual({
      status: 'quarantined',
      reason: 'chain-change',
    });
  });

  it('quarantines a draft authored against a different release', () => {
    saveLocalDraft(FORM_ID, { ...SCOPE, releaseId: 'v1.0.0' }, { reason: 'x' }, isPayload);
    expect(loadLocalDraft(FORM_ID, SCOPE)).toEqual({
      status: 'quarantined',
      reason: 'release-change',
    });
  });
});

describe('readLocalDraftPayload', () => {
  it('returns the validated payload of a compatible draft', () => {
    saveLocalDraft(FORM_ID, SCOPE, { reason: 'recover me' }, isPayload);
    const result = readLocalDraftPayload(FORM_ID, SCOPE, isPayload);
    expect(result.status).toBe('restored');
    if (result.status === 'restored') {
      expect(result.payload).toEqual({ reason: 'recover me' });
      expect(typeof result.savedAt).toBe('number');
    }
  });

  it('drops a stored payload that no longer validates', () => {
    saveLocalDraft(FORM_ID, SCOPE, { reason: 'ok' }, isPayload);
    const raw = localStorage.getItem(`truthbounty:form-draft:${FORM_ID}`);
    const parsed = JSON.parse(raw!);
    parsed.payload = { reason: 42 };
    localStorage.setItem(`truthbounty:form-draft:${FORM_ID}`, JSON.stringify(parsed));

    const result = readLocalDraftPayload(FORM_ID, SCOPE, isPayload);
    expect(result).toEqual({ status: 'rejected', reason: 'invalid-payload' });
    expect(localStorage.getItem(`truthbounty:form-draft:${FORM_ID}`)).toBeNull();
  });
});

describe('clearing drafts', () => {
  it('clearLocalDraft removes the draft', () => {
    saveLocalDraft(FORM_ID, SCOPE, { reason: 'x' }, isPayload);
    clearLocalDraft(FORM_ID);
    expect(loadLocalDraft(FORM_ID, SCOPE).status).toBe('none');
  });

  it('markDraftPersisted clears both the draft and its quarantine record', () => {
    saveLocalDraft(FORM_ID, { ...SCOPE, chainId: 11155420 }, { reason: 'x' }, isPayload);
    expect(loadLocalDraft(FORM_ID, SCOPE).status).toBe('quarantined');
    expect(readQuarantinedDraft(FORM_ID)).not.toBeNull();

    markDraftPersisted(FORM_ID);
    expect(readQuarantinedDraft(FORM_ID)).toBeNull();
    expect(loadLocalDraft(FORM_ID, SCOPE).status).toBe('none');
  });

  it('clearQuarantinedDraft removes only the quarantine record', () => {
    saveLocalDraft(FORM_ID, { ...SCOPE, chainId: 11155420 }, { reason: 'x' }, isPayload);
    loadLocalDraft(FORM_ID, SCOPE);
    clearQuarantinedDraft(FORM_ID);
    expect(readQuarantinedDraft(FORM_ID)).toBeNull();
  });
});

describe('quarantineIncompatibleDrafts sweep', () => {
  it('quarantines only drafts that do not match the active scope', () => {
    saveLocalDraft('a', SCOPE, { reason: 'keep' }, isPayload);
    saveLocalDraft('b', { ...SCOPE, address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' }, { reason: 'boom' }, isPayload);
    saveLocalDraft('c', { ...SCOPE, releaseId: 'v0' }, { reason: 'boom2' }, isPayload);

    const quarantined = quarantineIncompatibleDrafts(SCOPE).sort();
    expect(quarantined).toEqual(['b', 'c']);
    expect(loadLocalDraft('a', SCOPE).status).toBe('restored');
    expect(readQuarantinedDraft('b')?.reason).toBe('account-change');
    expect(readQuarantinedDraft('c')?.reason).toBe('release-change');
  });
});

describe('listDraftFormIds', () => {
  it('lists stored draft and quarantine form ids', () => {
    saveLocalDraft('a', SCOPE, { reason: 'x' }, isPayload);
    saveLocalDraft('b', { ...SCOPE, chainId: 11155420 }, { reason: 'x' }, isPayload);
    loadLocalDraft('b', SCOPE); // quarantine b
    expect(listDraftFormIds().sort()).toEqual(['a', 'b']);
  });
});

describe('helpers', () => {
  it('compares scopes case-insensitively for the address', () => {
    expect(
      draftScopesMatch(SCOPE, { ...SCOPE, address: SCOPE.address.toLowerCase() }),
    ).toBe(true);
    expect(draftScopesMatch(SCOPE, { ...SCOPE, chainId: 1 })).toBe(false);
    expect(draftScopesMatch(SCOPE, { ...SCOPE, releaseId: 'x' })).toBe(false);
  });

  it('detects nontrivial content', () => {
    expect(hasNontrivialContent({ title: '', description: '   ' })).toBe(false);
    expect(hasNontrivialContent({ title: 'claim' })).toBe(true);
    expect(hasNontrivialContent({ items: [] })).toBe(false);
    expect(hasNontrivialContent({ items: [{ note: 'x' }] })).toBe(true);
    expect(hasNontrivialContent(null)).toBe(false);
  });
});
