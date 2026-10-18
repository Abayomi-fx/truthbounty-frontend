/**
 * UI-FE-088 — determinism tests for the fixture library.
 *
 * Issue tests covered here:
 *  - "Identical inputs generate identical outputs."
 *  - "Snapshot deterministic output."
 */

import {
  CANONICAL_SCENARIOS,
  buildScenario,
  buildScenarioCatalogue,
} from '../scenarios';
import {
  FIXTURE_BUNDLE_MARKER,
  FIXTURE_EPOCH_ISO,
  FIXTURE_EPOCH_MS,
  createFixtureContext,
  fixtureHex,
  fixtureInt,
} from '../deterministic';

/** JSON serializer that keeps bigint fields comparable. */
function serialize(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) =>
    typeof entry === 'bigint' ? `${entry.toString()}n` : entry,
  );
}

/** Indented variant so snapshot diffs are reviewable line by line. */
function serializePretty(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, entry: unknown) => (typeof entry === 'bigint' ? `${entry.toString()}n` : entry),
    2,
  );
}

/** Compact, human-readable state matrix for the whole catalogue. */
function stateMatrix(): Array<Record<string, unknown>> {
  return CANONICAL_SCENARIOS.map((id) => {
    const scenario = buildScenario(id);
    return {
      id,
      viewState: scenario.ui.viewState,
      claimsRows: scenario.projection.claimsList?.items.length ?? null,
      projectionFreshness: scenario.projection.claimsList?.projection.freshness ?? null,
      projectionError: scenario.projection.claimsListError?.code ?? null,
      indexerLag: scenario.projection.freshness.freshness.lag,
      degraded: scenario.projection.freshness.degradedState.isDegraded,
      transaction: scenario.contract.transaction.state,
      finality: scenario.contract.finality.level,
      disputeSubmission: scenario.projection.disputeSubmission.status,
      routeAccessAllowed: scenario.ui.routeAccess.isAllowed,
      incidentSeverity: scenario.ui.incident.severity,
    };
  });
}

describe('fixture determinism (UI-FE-088)', () => {
  it('pins one fixture clock', () => {
    expect(FIXTURE_EPOCH_ISO).toBe('2026-10-14T00:00:00.000Z');
    expect(FIXTURE_EPOCH_MS).toBe(Date.parse(FIXTURE_EPOCH_ISO));
  });

  it('emits the production-boundary canary', () => {
    expect(FIXTURE_BUNDLE_MARKER).toBe(
      'TRUTHBOUNTY_TEST_ONLY_FIXTURE_FACTORY_UI_FE_088',
    );
  });

  it('derives identical values from identical keys', () => {
    expect(fixtureHex('claim-0001', 20)).toBe(fixtureHex('claim-0001', 20));
    expect(fixtureInt('stake:claim-0001', 1, 100)).toBe(
      fixtureInt('stake:claim-0001', 1, 100),
    );

    const left = createFixtureContext();
    const right = createFixtureContext();
    expect(left.address('claimant:claim-0001')).toBe(
      right.address('claimant:claim-0001'),
    );
    expect(left.isoAt(-1_000)).toBe(right.isoAt(-1_000));
  });

  it('derives different values for different keys', () => {
    expect(fixtureHex('claim-0001', 20)).not.toBe(fixtureHex('claim-0002', 20));
    const ctx = createFixtureContext();
    expect(ctx.address('claimant:claim-0001')).not.toBe(
      ctx.address('claimant:claim-0002'),
    );
    expect(ctx.hex('a', 32)).not.toBe(ctx.hex('b', 32));
  });

  it('generates well-formed deterministic values', () => {
    const ctx = createFixtureContext();
    expect(ctx.address('k')).toMatch(/^0x[0-9a-f]{40}$/);
    expect(ctx.hex('k', 32)).toMatch(/^0x[0-9a-f]{64}$/);
    expect(ctx.id('claim', 2)).toBe('claim-0003');
    const value = ctx.int('k', 5, 5);
    expect(value).toBe(5);
    for (let index = 0; index < 50; index += 1) {
      const rolled = ctx.int(`roll-${index}`, 1, 10);
      expect(rolled).toBeGreaterThanOrEqual(1);
      expect(rolled).toBeLessThanOrEqual(10);
    }
  });

  it('rebuilds every canonical scenario identically (identical inputs → identical outputs)', () => {
    for (const id of CANONICAL_SCENARIOS) {
      const first = buildScenario(id);
      const second = buildScenario(id);
      expect(serialize(second)).toBe(serialize(first));
      expect(second).toEqual(first);
    }
  });

  it('rebuilds the whole catalogue identically', () => {
    expect(serialize(buildScenarioCatalogue())).toBe(
      serialize(buildScenarioCatalogue()),
    );
  });

  it('keeps separate scenario seeds independent', () => {
    // A custom seed must still be reproducible, just distinct.
    const a = createFixtureContext('seed-a');
    const b = createFixtureContext('seed-a');
    const c = createFixtureContext('seed-b');
    expect(a.address('x')).toBe(b.address('x'));
    expect(a.address('x')).not.toBe(c.address('x'));
  });

  it('snapshots the deterministic catalogue output', () => {
    // Byte-exact coverage: any field change to any scenario fails here first.
    expect(serialize(buildScenarioCatalogue())).toMatchSnapshot();
  });

  it('snapshots the canonical state matrix', () => {
    expect(serializePretty(stateMatrix())).toMatchSnapshot();
  });

  it('snapshots one representative scenario in full', () => {
    expect(serializePretty(buildScenario('finalized'))).toMatchSnapshot();
  });
});
