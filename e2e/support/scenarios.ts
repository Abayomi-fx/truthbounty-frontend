/**
 * UI-FE-088 — Playwright adapter for the canonical scenario catalogue.
 *
 * Serves *the same* `CanonicalScenario` objects that Jest and Storybook
 * consume, so an e2e run, a unit assertion, and a Storybook screenshot always
 * describe one shared definition instead of three hand-written copies.
 *
 * The adapter only fulfils read paths (`GET /api/claims`). Unsupported backend
 * mutations are deliberately not mocked — that is a non-goal of the issue.
 */

import type { Page, Route } from '@playwright/test';

import type { Claim } from '../../src/app/types/claim';
import type { ClaimsListEnvelope } from '../../src/app/types/claim-list';
import {
  getScenario,
  type CanonicalScenarioId,
} from '../../src/testing/fixtures/scenarios';

export interface StubScenarioOptions {
  /**
   * Hold the response for this many ms before fulfilling it — used to pin the
   * `loading` state while an assertion runs. Default 0 (immediate).
   */
  delayMs?: number;
}

/** One recorded fulfilment, so tests can assert what the browser received. */
export interface ScenarioFulfilment {
  url: string;
  status: number;
  body: string;
}

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The claims payload a scenario serves for a plain `GET /api/claims`. */
export function scenarioClaimsPayload(id: CanonicalScenarioId): Claim[] | null {
  const scenario = getScenario(id);
  if (scenario.projection.claimsListError) return null;
  return scenario.projection.claims;
}

/** The claims-list envelope a scenario serves for a paged read. */
export function scenarioEnvelopePayload(id: CanonicalScenarioId): ClaimsListEnvelope | null {
  const scenario = getScenario(id);
  if (scenario.projection.claimsListError) return null;
  return scenario.projection.claimsList;
}

/**
 * Register `GET /api/claims` stubs backed by a canonical scenario.
 *
 * Register this inside the test body: Playwright runs route handlers in
 * reverse registration order, so it takes precedence over any earlier stub.
 * Fulfilments are appended to `fulfilments` for assertions.
 */
export async function stubScenarioClaimsApi(
  page: Page,
  id: CanonicalScenarioId,
  options: StubScenarioOptions = {},
): Promise<ScenarioFulfilment[]> {
  const scenario = getScenario(id);
  const fulfilments: ScenarioFulfilment[] = [];
  const delayMs = options.delayMs ?? 0;

  const fulfil = async (route: Route, status: number, body: unknown) => {
    if (delayMs > 0) await sleep(delayMs);
    const response = json(body, status);
    fulfilments.push({
      url: route.request().url(),
      status,
      body: response.body,
    });
    await route.fulfill(response);
  };

  await page.route('**/api/claims*', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    const failure = scenario.projection.claimsListError;
    if (failure) {
      // `unavailable` — the projection endpoint fails closed with 503.
      await fulfil(route, 503, { message: failure.message, code: failure.code });
      return;
    }

    const params = new URL(route.request().url()).searchParams;
    if (params.has('page') || params.has('pageSize')) {
      await fulfil(route, 200, scenario.projection.claimsList);
      return;
    }

    await fulfil(route, 200, scenario.projection.claims);
  });

  return fulfilments;
}
