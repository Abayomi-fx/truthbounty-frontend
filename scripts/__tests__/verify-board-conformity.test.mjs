import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  extractProtocolApprovedBoards,
  verifyManifest,
  generateEvidenceBundle,
  generateMarkdownSummary,
  scanForSecrets,
} from '../verify-board-conformity.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT, 'src', 'config', 'board-conformity-manifest.json');

describe('UI-FE-093 verify-board-conformity unit tests', () => {
  const originalManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const authorityBoards = extractProtocolApprovedBoards();

  it('extracts exactly 58 approved boards from protocol route authority', () => {
    assert.equal(authorityBoards.length, 58);
    const batches = new Set(authorityBoards.map((b) => b.batch));
    assert.equal(batches.has('foundation'), true);
    assert.equal(batches.has('public-claimant'), true);
    assert.equal(batches.has('verifier-dispute'), true);
    assert.equal(batches.has('privileged'), true);
    assert.equal(batches.has('support-legal'), true);
  });

  it('passes validation on the clean production manifest', () => {
    const result = verifyManifest(originalManifest, authorityBoards);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('fails validation when an approved authority board is missing', () => {
    const mutated = structuredClone(originalManifest);
    mutated.boards.pop(); // Remove 1 board

    const result = verifyManifest(mutated, authorityBoards);
    assert.equal(result.valid, false);
    assert.match(
      result.errors.join(' '),
      /expected exactly 58 approved boards|Approved authority board missing/,
    );
  });

  it('fails validation when an unapproved board is added', () => {
    const mutated = structuredClone(originalManifest);
    mutated.boards.push({
      boardId: 'designs/frontend-v2/invented/boards/99-invented.svg',
      batch: 'foundation',
      batchNumber: 1,
      name: 'Invented Board',
      canonicalRoute: '/invented',
      implementationStatus: 'implemented',
      approvalStatus: 'approved',
      requiredViewports: ['desktop', 'tablet', 'mobile', 'zoom200'],
      relevantStates: ['ready'],
      stableRegions: ['body'],
      maskedRegions: [],
      diffThreshold: 0.002,
      knownVariances: [],
    });

    const result = verifyManifest(mutated, authorityBoards);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), /unapproved board path/);
  });

  it('fails validation when protocol authority commit is unpinned or modified', () => {
    const mutated = structuredClone(originalManifest);
    mutated.protocolAuthority.commit = 'unpinned-commit-0000000000000000';

    const result = verifyManifest(mutated, authorityBoards);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), /does not match pinned authority/);
  });

  it('fails validation if any of the six batches is omitted', () => {
    const mutated = structuredClone(originalManifest);
    mutated.batches = mutated.batches.filter((b) => b.id !== 'verifier');

    const result = verifyManifest(mutated, authorityBoards);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), /Required batch "verifier" is missing/);
  });

  it('fails validation if an implemented board is missing any required viewport', () => {
    const mutated = structuredClone(originalManifest);
    const landing = mutated.boards.find((b) => b.canonicalRoute === '/');
    assert.ok(landing);
    landing.requiredViewports = ['desktop', 'tablet']; // Missing mobile and zoom200

    const result = verifyManifest(mutated, authorityBoards);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), /missing required viewport/);
  });

  it('fails validation if an implemented board has no relevant states', () => {
    const mutated = structuredClone(originalManifest);
    const landing = mutated.boards.find((b) => b.canonicalRoute === '/');
    assert.ok(landing);
    landing.relevantStates = [];

    const result = verifyManifest(mutated, authorityBoards);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), /no relevant states defined/);
  });

  it('fails validation if diff threshold exceeds maxAllowedDiffPixelRatio', () => {
    const mutated = structuredClone(originalManifest);
    const landing = mutated.boards.find((b) => b.canonicalRoute === '/');
    assert.ok(landing);
    landing.diffThreshold = 0.05; // 5% diff, max allowed is 0.005 (0.5%)

    const result = verifyManifest(mutated, authorityBoards);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), /exceeds max allowed/);
  });

  it('fails validation if a non-implemented screen lacks an explicit blockedReason record', () => {
    const mutated = structuredClone(originalManifest);
    const planned = mutated.boards.find((b) => b.implementationStatus === 'planned');
    assert.ok(planned);
    delete planned.blockedReason;

    const result = verifyManifest(mutated, authorityBoards);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), /missing an explicit blockedReason record/);
  });

  it('fails validation if a known variance is missing justification or approver', () => {
    const mutated = structuredClone(originalManifest);
    const landing = mutated.boards.find((b) => b.canonicalRoute === '/');
    assert.ok(landing);
    landing.knownVariances = [
      {
        id: 'VAR-TEST',
        category: 'layout',
        description: 'Test variance',
        justification: '', // empty justification
        approvedBy: '',
        approvedAt: '2026-10-19T00:00:00Z',
      },
    ];

    const result = verifyManifest(mutated, authorityBoards);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), /incomplete variance record/);
  });

  it('secret scanner catches simulated private keys and secrets', () => {
    const fakeKey = 'private_key = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"';
    const violations = scanForSecrets(fakeKey);
    assert.equal(violations.length > 0, true);

    const cleanData = JSON.stringify({ board: '01-landing.svg', status: 'clean' });
    const cleanViolations = scanForSecrets(cleanData);
    assert.equal(cleanViolations.length, 0);
  });

  it('generates deterministic evidence bundle with SHA-256 digests', () => {
    const bundle1 = generateEvidenceBundle(originalManifest, 'test-rev-12345');
    const bundle2 = generateEvidenceBundle(originalManifest, 'test-rev-12345');

    assert.equal(bundle1.bundleDigest, bundle2.bundleDigest);
    assert.equal(bundle1.totalApprovedBoards, 58);
    assert.equal(bundle1.protocolAuthorityRevision, '60c66b78cf797d8f821089c99ae1bc461009fecc');
    assert.equal(bundle1.batches.length, 6);
    assert.equal(bundle1.entries.length, 58);
  });

  it('generates reviewable markdown summary', () => {
    const bundle = generateEvidenceBundle(originalManifest, 'test-rev-12345');
    const md = generateMarkdownSummary(bundle);

    assert.match(md, /UI-FE-093 Approved-Board Conformity Review Bundle/);
    assert.match(md, /60c66b78cf797d8f821089c99ae1bc461009fecc/);
    assert.match(md, /Batch 1: Foundation Architecture/);
    assert.match(md, /Batch 6: Support, Incident Status/);
    assert.match(md, /Every approved screen has an implementation evidence entry/);
  });
});
