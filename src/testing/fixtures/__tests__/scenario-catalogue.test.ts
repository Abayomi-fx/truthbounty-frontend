/**
 * UI-FE-088 — canonical scenario catalogue tests.
 *
 * Issue tests covered here:
 *  - "Type-check fixture builders against pinned adapters" (compile-time via
 *    `tsc --noEmit`, plus the runtime guards exercised below).
 *  - "Every canonical system state has a named reusable fixture."
 *  - "Contract-derived values and API projections must remain visibly distinct."
 *  - "Fixtures must not encode secrets or production credentials."
 */

import { isClaimStatus, isClaimListItem } from '../../../app/types/claim-list';
import { getFreshnessStatus } from '../../../app/types/api-freshness';
import {
  CANONICAL_SCENARIOS,
  getScenario,
  type CanonicalScenarioId,
} from '../scenarios';
import { FIXTURE_BUNDLE_MARKER, FIXTURE_NETWORK } from '../deterministic';
import { LEGAL_CONTENT_IDS } from '../factories/legal-content';
import { makeLegalContentVersions } from '../factories/legal-content';

const EXPECTED_VIEW_STATE: Record<CanonicalScenarioId, string> = {
  loading: 'loading',
  empty: 'empty',
  stale: 'ready-stale',
  denied: 'ready',
  offline: 'ready-stale',
  unavailable: 'error',
  reverted: 'ready',
  replaced: 'ready',
  'indexing-delayed': 'ready-stale',
  reorged: 'ready',
  finalized: 'ready',
};

describe('canonical scenario catalogue (UI-FE-088)', () => {
  it('names every canonical system state', () => {
    expect([...CANONICAL_SCENARIOS]).toEqual([
      'loading',
      'empty',
      'stale',
      'denied',
      'offline',
      'unavailable',
      'reverted',
      'replaced',
      'indexing-delayed',
      'reorged',
      'finalized',
    ]);
  });

  it('gives every scenario a label, description, and stable id', () => {
    for (const id of CANONICAL_SCENARIOS) {
      const scenario = getScenario(id);
      expect(scenario.id).toBe(id);
      expect(scenario.label.length).toBeGreaterThan(0);
      expect(scenario.description.length).toBeGreaterThan(20);
      expect(scenario.network).toEqual(FIXTURE_NETWORK);
    }
  });

  it('maps each scenario onto its documented view state', () => {
    for (const id of CANONICAL_SCENARIOS) {
      expect(getScenario(id).ui.viewState).toBe(EXPECTED_VIEW_STATE[id]);
    }
  });

  it('produces projection rows that satisfy the pinned runtime guards', () => {
    for (const id of CANONICAL_SCENARIOS) {
      const { claimsList, claims, claim } = getScenario(id).projection;
      expect(isClaimStatus(claim.status)).toBe(true);
      for (const item of claimsList?.items ?? []) {
        expect(isClaimListItem(item)).toBe(true);
      }
      for (const record of claims) {
        expect(isClaimStatus(record.status)).toBe(true);
        expect(record.evidence.length).toBeGreaterThan(0);
      }
      if (claimsList) {
        expect(claimsList.pagination.totalPages).toBeGreaterThanOrEqual(1);
        expect(['fresh', 'stale', 'degraded']).toContain(
          claimsList.projection.freshness,
        );
      }
    }
  });

  it('keeps contract-derived values visibly distinct from API projections', () => {
    const contractKeys = Object.keys(getScenario('finalized').contract).sort();
    const projectionKeys = Object.keys(getScenario('finalized').projection).sort();

    expect(contractKeys).toEqual([
      'finality',
      'onChainVerification',
      'release',
      'transaction',
    ]);
    expect(projectionKeys).toEqual([
      'claim',
      'claims',
      'claimsList',
      'claimsListError',
      'dispute',
      'disputeSubmission',
      'freshness',
      'verifications',
    ]);

    for (const id of CANONICAL_SCENARIOS) {
      const scenario = getScenario(id);
      // Contract bucket never carries projection metadata …
      expect(scenario.contract.release.chainId).toBe(FIXTURE_NETWORK.chainId);
      expect(scenario.contract).not.toHaveProperty('projection');
      // … and the projection bucket never carries the pinned release.
      expect(scenario.projection).not.toHaveProperty('release');
      if (scenario.projection.claimsList) {
        expect(scenario.projection.claimsList.projection).toBeDefined();
      }
      // The canary proves fixtures are marked as test-only in the bundle.
      expect(FIXTURE_BUNDLE_MARKER).toContain('TEST_ONLY_FIXTURE');
    }
  });

  it('drives the transaction states the issue calls out', () => {
    expect(getScenario('reverted').contract.transaction.state).toBe('reverted');
    expect(getScenario('reverted').contract.finality.context.receiptStatus).toBe('0x0');
    expect(getScenario('reverted').projection.disputeSubmission.status).toBe('REVERTED');

    const replaced = getScenario('replaced').contract.transaction;
    expect(replaced.state).toBe('failed');
    if (replaced.state === 'failed') expect(replaced.reason).toBe('nonce-too-low');
    expect(getScenario('replaced').projection.disputeSubmission.status).toBe('REPLACED');

    expect(getScenario('indexing-delayed').contract.transaction.state).toBe('indexing');
    expect(getScenario('finalized').contract.transaction.state).toBe('finalized');
    expect(getScenario('finalized').contract.finality.level).toBe('finalized');
    expect(getScenario('reorged').contract.finality.level).toBe('reorged');
    expect(getScenario('reorged').contract.finality.isReorged).toBe(true);
    expect(getScenario('loading').contract.transaction.state).toBe('submitted');
  });

  it('drives freshness, denial, and failure states', () => {
    expect(getScenario('loading').projection.claimsList).toBeNull();

    const empty = getScenario('empty').projection.claimsList;
    expect(empty?.items).toEqual([]);
    expect(empty?.pagination.total).toBe(0);
    expect(getScenario('empty').projection.claims).toEqual([]);

    expect(getScenario('stale').projection.claimsList?.projection.freshness).toBe('stale');
    expect(getFreshnessStatus(getScenario('stale').projection.freshness.freshness.lag)).not.toBe(
      'fresh',
    );

    const denied = getScenario('denied').ui;
    expect(denied.routeAccess.isAllowed).toBe(false);
    expect(denied.routeAccess.denialReason).toBe('admin_role_required');
    expect(Object.values(denied.capabilities).every((value) => value === false)).toBe(true);
    expect(denied.roles.isGuest).toBe(true);

    expect(getScenario('offline').projection.freshness.degradedState.isDegraded).toBe(true);
    expect(getScenario('offline').projection.claimsList?.projection.reason).toMatch(/offline/i);

    const unavailable = getScenario('unavailable').projection;
    expect(unavailable.claimsList).toBeNull();
    expect(unavailable.claimsListError?.code).toBe('PROJECTION_UNAVAILABLE');
    expect(unavailable.freshness.degradedState.isDegraded).toBe(true);

    const indexing = getScenario('indexing-delayed').projection;
    expect(indexing.freshness.freshness.lag).toBeGreaterThan(100);
    expect(indexing.freshness.degradedState.degradationReason).toBe('indexer_lag');
    expect(indexing.claimsList?.projection.freshness).toBe('stale');
  });

  it('carries one incident and one legal-content version per scenario', () => {
    const seenLegal = new Set<string>();
    for (const id of CANONICAL_SCENARIOS) {
      const { incident, legalContent } = getScenario(id).ui;
      expect(incident.category).toBe('incident');
      expect(incident.id).toMatch(/^0x[0-9a-f]{32}$/);
      expect(incident.timestamp).toBe('2026-10-14T00:00:00.000Z');
      expect(legalContent.contentDigest).toMatch(/^0x[0-9a-f]{64}$/);
      seenLegal.add(legalContent.id);
    }
    for (const id of seenLegal) {
      expect(LEGAL_CONTENT_IDS).toContain(id);
    }
    // The factory catalogue versions every legal document.
    expect(makeLegalContentVersions().map((entry) => entry.id).sort()).toEqual(
      [...LEGAL_CONTENT_IDS].sort(),
    );
  });

  it('encodes no secrets, credentials, or private hosts', () => {
    const serialized = JSON.stringify(getScenario('finalized'), (_key, entry: unknown) =>
      typeof entry === 'bigint' ? `${entry.toString()}n` : entry,
    );
    expect(serialized).not.toMatch(/(api[_-]?key|secret|private[_-]?key|mnemonic|Bearer\s)/i);
    expect(serialized).not.toMatch(/localhost|127\.0\.0\.1|http:\/\//i);
    // Every URL host must be an allow-listed fixture/reserved host.
    const hosts = [...serialized.matchAll(/https?:\/\/([^/"']+)/gi)].map((entry) =>
      entry[1].toLowerCase(),
    );
    const allowedHosts = ['evidence.example.test', 'sepolia-optimism.etherscan.io'];
    for (const host of hosts) expect(allowedHosts).toContain(host);
  });
});
