import {
  createDisputeDraftStore,
  createMemoryDisputeDraftStore,
  disputeDraftStorageKey,
  parseDisputeDraft,
  sanitizeDisputeDraft,
  serializeDisputeDraft,
} from '@/lib/dispute/draft';
import { DISPUTE_DRAFT_VERSION } from '@/app/types/dispute-entry';

const CLAIM = '42';
const BOND = '1000000000000000000';

function input(overrides: Record<string, unknown> = {}) {
  return {
    claimId: CLAIM,
    reason: 'The provisional outcome double counted one verifier stake.',
    evidence: [{ uri: 'https://example.com/evidence' }],
    bondAtDraft: BOND,
    updatedAt: '2026-10-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('sanitizeDisputeDraft', () => {
  it('produces a versioned draft with the pinned bond', () => {
    const { draft, redactions, droppedEvidence } = sanitizeDisputeDraft(input());

    expect(draft.version).toBe(DISPUTE_DRAFT_VERSION);
    expect(draft.claimId).toBe(CLAIM);
    expect(draft.bondAtDraft).toBe(BOND);
    expect(redactions).toBe(0);
    expect(droppedEvidence).toHaveLength(0);
  });

  it('redacts prohibited secrets from the reason text', () => {
    const { draft, redactions } = sanitizeDisputeDraft(
      input({
        reason:
          'Verifier used my api_key=super-secret-value to submit; my password: hunter2',
      })
    );

    expect(redactions).toBe(2);
    expect(draft.reason).not.toContain('super-secret-value');
    expect(draft.reason).not.toContain('hunter2');
    expect(draft.reason).toContain('[redacted]');
  });

  it('drops evidence links that fail the integrity checks', () => {
    const { draft, droppedEvidence } = sanitizeDisputeDraft(
      input({
        evidence: [
          { uri: 'https://example.com/ok' },
          { uri: 'javascript:alert(1)' },
          { uri: 'https://example.com/?token=secret-token-value' },
          { uri: 'https://example.com/bad-digest', digest: 'nothex' },
        ],
      })
    );

    expect(draft.evidence).toEqual([{ uri: 'https://example.com/ok' }]);
    expect(droppedEvidence).toHaveLength(3);
  });

  it('normalizes digests and trims uris', () => {
    const { draft } = sanitizeDisputeDraft(
      input({
        evidence: [
          {
            uri: '  https://example.com/a  ',
            digest: 'A'.repeat(64),
          },
        ],
      })
    );

    expect(draft.evidence).toEqual([
      { uri: 'https://example.com/a', digest: `0x${'a'.repeat(64)}` },
    ]);
  });

  it('never persists prohibited secrets through the serialized form', () => {
    const json = serializeDisputeDraft(
      input({
        reason: 'leaked seed_phrase=alpha beta gamma delta',
      })
    );

    expect(json).not.toContain('alpha beta gamma delta');
    expect(json).toContain('[redacted]');
  });
});

describe('parseDisputeDraft', () => {
  it('round-trips a serialized draft', () => {
    const json = serializeDisputeDraft(input());
    expect(parseDisputeDraft(json, CLAIM)).toEqual(JSON.parse(json));
  });

  it('fails closed on malformed JSON', () => {
    expect(parseDisputeDraft('{not json', CLAIM)).toBeNull();
    expect(parseDisputeDraft('', CLAIM)).toBeNull();
    expect(parseDisputeDraft(null)).toBeNull();
  });

  it('fails closed on unknown schema versions', () => {
    const json = JSON.stringify({ ...JSON.parse(serializeDisputeDraft(input())), version: 99 });
    expect(parseDisputeDraft(json, CLAIM)).toBeNull();
  });

  it('fails closed when the draft belongs to another claim', () => {
    const json = serializeDisputeDraft(input());
    expect(parseDisputeDraft(json, '99')).toBeNull();
  });

  it('fails closed on structurally invalid drafts', () => {
    const base = JSON.parse(serializeDisputeDraft(input()));
    expect(parseDisputeDraft(JSON.stringify({ ...base, reason: 5 }), CLAIM)).toBeNull();
    expect(parseDisputeDraft(JSON.stringify({ ...base, evidence: 'x' }), CLAIM)).toBeNull();
    expect(
      parseDisputeDraft(JSON.stringify({ ...base, evidence: [{ nope: 1 }] }), CLAIM)
    ).toBeNull();
    expect(parseDisputeDraft(JSON.stringify({ ...base, updatedAt: 7 }), CLAIM)).toBeNull();
    expect(parseDisputeDraft(JSON.stringify({ ...base, claimId: '' }), CLAIM)).toBeNull();
    expect(
      parseDisputeDraft(JSON.stringify({ ...base, bondAtDraft: 5 }), CLAIM)
    ).toBeNull();
  });

  it('accepts a null bond', () => {
    const json = serializeDisputeDraft(input({ bondAtDraft: null }));
    expect(parseDisputeDraft(json, CLAIM)?.bondAtDraft).toBeNull();
  });
});

describe('dispute draft stores', () => {
  it('derives the namespaced storage key', () => {
    expect(disputeDraftStorageKey(CLAIM)).toBe(
      `truthbounty.dispute-draft.v1.${CLAIM}`
    );
  });

  it('saves only sanitized drafts', () => {
    const store = createMemoryDisputeDraftStore();
    const saved = store.save(
      input({ reason: 'password: hunter2 was used by the verifier' })
    );

    expect(saved.redactions).toBe(1);
    const raw = store.backing.get(disputeDraftStorageKey(CLAIM));
    expect(raw).not.toBeNull();
    expect(raw).not.toContain('hunter2');
  });

  it('loads the draft for the matching claim only', () => {
    const store = createMemoryDisputeDraftStore();
    store.save(input());
    expect(store.load(CLAIM)?.claimId).toBe(CLAIM);
    expect(store.load('99')).toBeNull();
  });

  it('discards the stored draft', () => {
    const store = createMemoryDisputeDraftStore();
    store.save(input());
    store.discard(CLAIM);
    expect(store.load(CLAIM)).toBeNull();
    expect(store.backing.has(disputeDraftStorageKey(CLAIM))).toBe(false);
  });

  it('re-sanitizes on load when storage was tampered with', () => {
    const backing = new Map<string, string>();
    const store = createDisputeDraftStore({
      getItem: (key) => backing.get(key) ?? null,
      setItem: (key, value) => backing.set(key, value),
      removeItem: (key) => backing.delete(key),
    });
    // A tampered draft with an unsupported-scheme evidence link.
    backing.set(
      disputeDraftStorageKey(CLAIM),
      JSON.stringify({
        version: DISPUTE_DRAFT_VERSION,
        claimId: CLAIM,
        reason: 'r',
        evidence: [{ uri: 'javascript:alert(1)' }],
        bondAtDraft: null,
        updatedAt: '2026-10-15T00:00:00.000Z',
      })
    );

    // Parse succeeds (structure is valid); the composition re-validates
    // evidence integrity before any mutation is possible.
    expect(store.load(CLAIM)?.evidence).toHaveLength(1);
  });

  it('fails closed when the backend throws', () => {
    const store = createDisputeDraftStore({
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    });

    expect(store.load(CLAIM)).toBeNull();
    expect(() => store.save(input())).not.toThrow();
    expect(() => store.discard(CLAIM)).not.toThrow();
  });

  it('seeds a memory store from raw serialized drafts', () => {
    const json = serializeDisputeDraft(input());
    const store = createMemoryDisputeDraftStore({
      [disputeDraftStorageKey(CLAIM)]: json,
    });
    expect(store.load(CLAIM)?.reason).toBe(
      'The provisional outcome double counted one verifier stake.'
    );
  });
});
