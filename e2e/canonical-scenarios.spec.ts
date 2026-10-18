/**
 * UI-FE-088 — Playwright consumer of the canonical scenario catalogue.
 *
 * Two jobs:
 *  1. Prove the catalogue is deterministic and that Storybook and Playwright
 *     consume the *same* scenario definitions (issue test: "Prove Storybook and
 *     Playwright consume the same scenario definitions").
 *  2. Drive real app reads from shared fixtures: the browser receives the exact
 *     payload the Jest tests snapshot and the Storybook stories render.
 *
 * Surfaces that only Storybook renders today (reorged, replaced, indexing-
 * delayed banners) are asserted in Jest and rendered in Storybook rather than
 * duplicated here with brittle selectors; this spec covers what the running
 * app actually gates on: loading, projection failure, and payload delivery.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

import {
  CANONICAL_SCENARIOS,
  buildScenario,
  getScenario,
  type CanonicalScenarioId,
} from '../src/testing/fixtures/scenarios';
import { stubScenarioClaimsApi } from './support/scenarios';

/** JSON serializer that keeps bigint fields comparable. */
function serialize(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) =>
    typeof entry === 'bigint' ? `${entry.toString()}n` : entry,
  );
}

const CLAIMS_TABLE = 'table[aria-label="Active claims"]';

test.describe('canonical scenario fixtures (UI-FE-088)', () => {
  test.describe('shared catalogue', () => {
    test('exposes exactly the canonical system states', () => {
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

    test('identical inputs generate identical outputs', () => {
      for (const id of CANONICAL_SCENARIOS) {
        expect(serialize(buildScenario(id))).toBe(serialize(getScenario(id)));
      }
    });

    test('Storybook and Playwright consume the same scenario definitions', () => {
      const read = (relative: string) =>
        readFileSync(path.join(process.cwd(), relative), 'utf8');

      const storybookSource = read('src/testing/fixtures/scenarios.stories.tsx');
      const adapterSource = read('e2e/support/scenarios.ts');

      expect(storybookSource).toContain("from './scenarios'");
      expect(adapterSource).toContain('src/testing/fixtures/scenarios');

      for (const id of CANONICAL_SCENARIOS) {
        // The story file declares a story per canonical id …
        expect(storybookSource).toContain(`'${id}'`);
      }
      // … and the Playwright adapter builds payloads from that same catalogue.
      expect(adapterSource).toContain('getScenario(id)');
    });
  });

  test.describe('scenario payloads served to the app', () => {
    test('the browser receives the shared fixture payload', async ({ page }) => {
      const id: CanonicalScenarioId = 'finalized';
      const fulfilments = await stubScenarioClaimsApi(page, id);

      await page.goto('/');
      await expect.poll(() => fulfilments.length, { timeout: 15_000 }).toBeGreaterThan(0);

      expect(fulfilments[0].url).toContain('/api/claims');
      expect(fulfilments[0].status).toBe(200);
      // Byte-for-byte the object Jest snapshots and Storybook renders.
      expect(fulfilments[0].body).toBe(
        JSON.stringify(getScenario(id).projection.claims),
      );
    });

    test('the loading state holds until the projection arrives', async ({ page }) => {
      await stubScenarioClaimsApi(page, 'loading', { delayMs: 3_000 });

      await page.goto('/');
      // No fabricated content while the read is in flight.
      await expect(page.getByText('Safe Treasury Withdrawal')).toBeHidden();
      // …and the shared fixture payload renders once it resolves.
      await expect(page.getByText('Safe Treasury Withdrawal')).toBeVisible({
        timeout: 20_000,
      });
    });

    test('the unavailable projection fails closed instead of inventing data', async ({
      page,
    }) => {
      await stubScenarioClaimsApi(page, 'unavailable');

      await page.goto('/');
      await expect(page.getByTestId('claims-read-notice-error')).toBeVisible();
      await expect(page.locator(CLAIMS_TABLE)).toBeHidden();
    });

    test('the empty projection renders an explicit empty state', async ({ page }) => {
      const fulfilments = await stubScenarioClaimsApi(page, 'empty');

      await page.goto('/');
      await expect(page.locator(CLAIMS_TABLE)).toBeVisible();
      await expect(page.locator(CLAIMS_TABLE)).toContainText(
        'No active claims at the moment.',
      );
      await expect.poll(() => fulfilments.length, { timeout: 15_000 }).toBeGreaterThan(0);
      expect(JSON.parse(fulfilments[0].body)).toEqual([]);
    });
  });
});
