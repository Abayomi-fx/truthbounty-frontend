import { adaptDocumentationRecords, type DocumentationRecord } from '../content';

const approvedRecord: DocumentationRecord = {
  publicationStatus: 'approved',
  slug: 'transaction-states',
  title: 'Transaction states',
  summary: 'Understand the states shown for a transaction.',
  audience: 'guidance',
  topic: 'Transactions',
  version: '2.0',
  lastReviewedAt: '2026-10-09',
  appliesTo: 'TB-V2',
  release: 'Optimism/EVM',
  order: 1,
  tags: ['receipts'],
  blocks: [
    { type: 'heading', id: 'canonical-state', text: 'Canonical state', level: 2 },
    { type: 'paragraph', text: 'Use the canonical receipt as the source of truth.' },
  ],
  sources: [{ title: 'Protocol documentation', href: 'https://example.org/protocol' }],
  relatedSlugs: ['missing-article'],
};

describe('adaptDocumentationRecords', () => {
  it('publishes only complete approved records and removes unknown related links', () => {
    const result = adaptDocumentationRecords([
      approvedRecord,
      { ...approvedRecord, slug: 'draft', publicationStatus: 'draft' },
      { ...approvedRecord, slug: 'missing-source', sources: [] },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('transaction-states');
    expect(result[0].relatedSlugs).toEqual([]);
  });

  it('renders hostile strings as sanitized text and rejects unsafe source URLs', () => {
    const result = adaptDocumentationRecords([{
      ...approvedRecord,
      title: '<img src=x onerror=alert(1)>\u0000',
      sources: [
        { title: 'Unsafe', href: 'javascript:alert(1)' },
        { title: 'Safe source', href: 'https://example.org/source' },
      ],
      blocks: [{ type: 'paragraph', text: '<script>alert(1)</script>\u0000' }],
    }]);

    expect(result[0].title).toBe('<img src=x onerror=alert(1)>');
    expect(result[0].blocks).toEqual([
      { type: 'paragraph', text: '<script>alert(1)</script>' },
    ]);
    expect(result[0].sources).toEqual([
      { title: 'Safe source', href: 'https://example.org/source' },
    ]);
  });

  it('fails closed when version applicability metadata is missing or invalid', () => {
    expect(adaptDocumentationRecords([
      { ...approvedRecord, appliesTo: '' },
      { ...approvedRecord, lastReviewedAt: 'not-a-date' },
      { ...approvedRecord, lastReviewedAt: '2026-02-31' },
    ])).toEqual([]);
  });

  it('deduplicates heading anchors and duplicate publication slugs', () => {
    const record = {
      ...approvedRecord,
      blocks: [
        { type: 'heading' as const, id: 'same-id', text: 'First section', level: 2 as const },
        { type: 'heading' as const, id: 'same-id', text: 'Duplicate section', level: 2 as const },
      ],
    };

    const result = adaptDocumentationRecords([record, { ...approvedRecord, title: 'Duplicate slug' }]);
    expect(result).toHaveLength(1);
    expect(result[0].blocks).toHaveLength(1);
  });
});