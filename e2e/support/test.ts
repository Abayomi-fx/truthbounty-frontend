import { test as base, expect, type Page } from '@playwright/test';
import { seededClaims, seededClaimById } from './claims';
import type { ClaimListItem, ClaimsListEnvelope } from '../../src/app/types/claim-list';

const STATUS_QUERY_MAP: Record<string, string> = {
  verified: 'VERIFIED',
  open: 'OPEN',
  disputed: 'DISPUTED',
  rejected: 'REJECTED',
  'under-review': 'UNDER_REVIEW',
  under_review: 'UNDER_REVIEW',
};

/**
 * Map a seeded claim onto the canonical claims-list row shape.
 *
 * The list projection is validated client side (`isClaimListItem`), so the stub
 * has to serve real projection rows rather than the legacy bare `Claim[]`
 * envelope. `highImpact` and `confidenceScore` are derived from the seeded
 * fixture only; they are stub values, not protocol reads.
 */
function toListItem(claim: (typeof seededClaims)[number]): ClaimListItem {
  return {
    id: claim.id,
    title: claim.title,
    status: claim.status,
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
    totalStaked: claim.totalStaked,
    category: claim.category,
    claimantAddress: claim.claimantAddress,
    highImpact: claim.totalStaked >= 45000,
    confidenceScore: claim.status === 'VERIFIED' ? 0.9 : claim.status === 'UNDER_REVIEW' ? 0.5 : null,
  };
}

/** Build a validated claims-list envelope for the given query parameters. */
function claimsListEnvelope(params: URLSearchParams): ClaimsListEnvelope {
  const search = (params.get('search') ?? '').trim().toLowerCase();
  const rawStatus = params.get('status');
  const status = rawStatus
    ? STATUS_QUERY_MAP[rawStatus.toLowerCase()] ?? rawStatus.toUpperCase()
    : null;
  const highImpactOnly = params.get('highImpact') === 'true';

  const matched = seededClaims.filter((claim) => {
    if (status && claim.status !== status) return false;
    if (highImpactOnly && claim.totalStaked < 45000) return false;
    if (search && !claim.title.toLowerCase().includes(search)) return false;
    return true;
  });

  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const pageSize = Math.max(1, Number(params.get('pageSize') ?? '25') || 25);
  const total = matched.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const offset = (page - 1) * pageSize;

  return {
    items: matched.slice(offset, offset + pageSize).map(toListItem),
    pagination: { page, pageSize, total, totalPages },
    projection: { freshness: 'fresh', generatedAt: '2024-01-02T00:00:00.000Z' },
  };
}

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

export async function stubClaimsApi(page: Page) {
  await page.route('**/api/claims/*', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    const claim = seededClaimById.get(id);
    await route.fulfill(claim ? json(claim) : json({ message: 'Not found' }, 404));
  });

  await page.route('**/api/claims*', async (route) => {
    const request = route.request();

    if (request.method() === 'POST') {
      const payload = request.postDataJSON() as { title?: string; description?: string };
      const now = new Date().toISOString();
      await route.fulfill(
        json(
          {
            id: 'claim-created',
            title: payload?.title ?? 'Untitled claim',
            description: payload?.description ?? '',
            claimantAddress: '0x4444444444444444444444444444444444444444',
            status: 'OPEN',
            bountyAmount: 0,
            totalStaked: 0,
            evidence: [],
            createdAt: now,
            updatedAt: now,
          },
          201,
        ),
      );
      return;
    }

    const params = new URL(request.url()).searchParams;

    // The paginated claims-list projection always sends `page`/`pageSize` and
    // expects the validated envelope; the legacy detail/list reads do not.
    if (params.has('page') || params.has('pageSize')) {
      await route.fulfill(json(claimsListEnvelope(params)));
      return;
    }

    const status = params.get('status');
    if (!status) {
      await route.fulfill(json(seededClaims));
      return;
    }

    const normalised = STATUS_QUERY_MAP[status.toLowerCase()] ?? status.toUpperCase();
    await route.fulfill(json(seededClaims.filter((claim) => claim.status === normalised)));
  });
}

export const test = base.extend<{ stubbedApi: void }>({
  stubbedApi: [
    async ({ page }, use) => {
      await stubClaimsApi(page);
      await use();
    },
    { auto: true },
  ],
});

export { expect };
