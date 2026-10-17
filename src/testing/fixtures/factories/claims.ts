/**
 * UI-FE-088 — typed claim factories.
 *
 * Conforms to the pinned interfaces in `src/app/types/claim.ts` and
 * `src/app/types/claim-list.ts`. Two families are produced here on purpose:
 *
 *  - `makeClaim` → protocol/API domain object (`Claim`), and
 *  - `makeClaimListItem` / `makeClaimsListEnvelope` → API *projection* rows.
 *
 * Contract-derived values never appear in this module; contract data is built
 * by `factories/releases.ts` and `factories/transactions.ts`, which keeps the
 * two families visibly distinct (issue constraint).
 */

import type { Claim, ClaimStatus } from '../../../app/types/claim';
import type {
  ClaimListItem,
  ClaimsListEnvelope,
  ProjectionFreshness,
} from '../../../app/types/claim-list';
import { createFixtureContext, type FixtureContext } from '../deterministic';
import { makeEvidenceSet } from './evidence';

/** Fixed claim titles — no RNG, no locale-dependent generation. */
export const CLAIM_TITLES: readonly string[] = [
  'Global average temperatures increased by 1.1°C since pre-industrial times',
  'New vaccine shows 95% efficacy in Phase 3 trials',
  'Tech company achieved quantum supremacy milestone',
  'Ocean acidity has risen by 26% since the industrial era',
  'Grid-scale battery capacity doubled year over year',
] as const;

/** Fixed category pool, indexed deterministically. */
export const CLAIM_CATEGORIES: readonly string[] = [
  'Climate',
  'Health',
  'Technology',
  'Environment',
  'Energy',
] as const;

/** All canonical claim statuses, in a fixed order. */
export const CLAIM_STATUSES: readonly ClaimStatus[] = [
  'VERIFIED',
  'UNDER_REVIEW',
  'DISPUTED',
  'OPEN',
  'REJECTED',
] as const;

export interface MakeClaimOptions {
  /** Stable index driving title, status, timestamps, and ids. Default 0. */
  index?: number;
  /** Field-level overrides applied last, so callers can shape a scenario. */
  overrides?: Partial<Claim>;
  ctx?: FixtureContext;
}

/** Build a pinned-shape `Claim` with deterministic values. */
export function makeClaim(options: MakeClaimOptions = {}): Claim {
  const { index = 0, overrides = {}, ctx = createFixtureContext() } = options;
  const id = overrides.id ?? ctx.id('claim', index);
  const createdAt = ctx.isoAt(-86_400_000 * (index + 1));

  const claim: Claim = {
    id,
    title: CLAIM_TITLES[index % CLAIM_TITLES.length],
    description: `Fixture claim description ${index + 1}. Deterministic text produced by the UI-FE-088 factory library for scenario "${id}".`,
    category: CLAIM_CATEGORIES[index % CLAIM_CATEGORIES.length],
    claimantAddress: ctx.address(`claimant:${id}`),
    proposer: ctx.address(`proposer:${id}`),
    status: CLAIM_STATUSES[index % CLAIM_STATUSES.length],
    bountyAmount: ctx.int(`bounty:${id}`, 1_000, 50_000),
    totalStaked: ctx.int(`stake:${id}`, 500, 45_000),
    evidence: makeEvidenceSet(id, 2, ctx),
    createdAt,
    updatedAt: ctx.isoAt(-43_200_000 * (index + 1)),
    expiresAt: ctx.isoAt(86_400_000 * (index + 7)),
  };

  return { ...claim, ...overrides };
}

/** Build `count` claims with stable indexes 0..count-1. */
export function makeClaimSet(count: number, ctx: FixtureContext = createFixtureContext()): Claim[] {
  return Array.from({ length: count }, (_unused, index) => makeClaim({ index, ctx }));
}

export interface MakeClaimListItemOptions {
  index?: number;
  overrides?: Partial<ClaimListItem>;
  ctx?: FixtureContext;
}

/**
 * Build a `ClaimListItem` — the API *projection* row, never a contract value.
 * `confidenceScore` is explicitly `null` for indexes the projection has not
 * scored, mirroring how the API withholds rather than invents values.
 */
export function makeClaimListItem(options: MakeClaimListItemOptions = {}): ClaimListItem {
  const { index = 0, overrides = {}, ctx = createFixtureContext() } = options;
  const claim = makeClaim({ index, ctx });

  const item: ClaimListItem = {
    id: claim.id,
    title: claim.title,
    category: claim.category,
    status: claim.status,
    claimantAddress: claim.claimantAddress,
    confidenceScore: index % 3 === 2 ? null : ctx.int(`confidence:${claim.id}`, 55, 99),
    totalStaked: claim.totalStaked,
    highImpact: claim.totalStaked >= 30_000,
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
  };

  return { ...item, ...overrides };
}

export interface MakeClaimsListEnvelopeOptions {
  /** Explicit rows; defaults to three deterministic projection rows. */
  items?: ClaimListItem[];
  page?: number;
  pageSize?: number;
  /** Server-reported total; defaults to `items.length`. */
  total?: number;
  freshness?: ProjectionFreshness;
  /** Projection generation timestamp; defaults to the pinned epoch. */
  generatedAt?: string;
  /** Server-reported reason, required for `stale` / `degraded`. */
  reason?: string;
  ctx?: FixtureContext;
}

/**
 * Build a `ClaimsListEnvelope` — the validated API read-path shape.
 * Pagination math matches the server contract (`totalPages >= 1`).
 */
export function makeClaimsListEnvelope(
  options: MakeClaimsListEnvelopeOptions = {},
): ClaimsListEnvelope {
  const ctx = options.ctx ?? createFixtureContext();
  const items = options.items ?? [0, 1, 2].map((index) => makeClaimListItem({ index, ctx }));
  const pageSize = options.pageSize ?? 10;
  const total = options.total ?? items.length;
  const freshness = options.freshness ?? 'fresh';

  return {
    items,
    pagination: {
      page: options.page ?? 1,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    projection: {
      freshness,
      generatedAt: options.generatedAt ?? ctx.nowIso,
      ...(options.reason === undefined ? {} : { reason: options.reason }),
    },
  };
}
