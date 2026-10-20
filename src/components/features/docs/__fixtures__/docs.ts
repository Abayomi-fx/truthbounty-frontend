import { adaptDocumentationRecords, type DocumentationRecord } from '@/lib/docs/content';

const records: DocumentationRecord[] = [
  {
    publicationStatus: 'approved',
    slug: 'transaction-states',
    title: 'Read transaction states',
    summary: 'Understand submitted, confirmed, finalized, and reorged states.',
    audience: 'guidance',
    topic: 'Transactions',
    version: '2.0',
    lastReviewedAt: '2026-10-09',
    appliesTo: 'TB-V2',
    release: 'Optimism/EVM',
    order: 1,
    tags: ['receipt', 'recovery'],
    blocks: [
      { type: 'heading', id: 'before-you-start', text: 'Before you start', level: 2 },
      { type: 'paragraph', text: 'A successful wallet submission is not final settlement or API indexing.' },
      { type: 'callout', title: 'Canonical receipt first', text: 'Use the canonical receipt as the protocol state source.' },
      { type: 'heading', id: 'read-the-state', text: 'Read the canonical state', level: 2 },
      { type: 'list', items: ['Check the selected network.', 'Match the transaction hash.'] },
    ],
    sources: [{ title: 'Transaction state model', href: 'https://github.com/DigiNodes/truthbounty-protocol' }],
    relatedSlugs: ['claim-evidence'],
  },
  {
    publicationStatus: 'approved',
    slug: 'claim-evidence',
    title: 'Publish claim evidence',
    summary: 'Review how sources are represented in a claim.',
    audience: 'protocol',
    topic: 'Claims',
    version: '2.0',
    lastReviewedAt: '2026-10-09',
    appliesTo: 'TB-V2',
    release: 'Optimism/EVM',
    order: 2,
    tags: ['claims', 'sources'],
    blocks: [{ type: 'heading', id: 'sources', text: 'Sources', level: 2 }],
    sources: [{ title: 'Evidence model', href: 'https://github.com/DigiNodes/truthbounty-protocol' }],
    relatedSlugs: ['transaction-states'],
  },
];

export const docsFixture = adaptDocumentationRecords(records);