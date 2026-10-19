import { test, expect } from ‘@playwright/test’;

const canonicalRoutes = [
{ path: ‘/’, name: ‘Home / Claims Feed’ },
{ path: ‘/how-it-works’, name: ‘How It Works’ },
{ path: ‘/treasury’, name: ‘Treasury’ },
{ path: ‘/claims/new’, name: ‘New Claim’ },
{ path: ‘/claims/unknown-production-smoke-id’, name: ‘Unknown Claim ID’ },
{ path: ‘/claim-detail’, name: ‘Claim Detail’ },
{ path: ‘/identity’, name: ‘Identity’ },
{ path: ‘/rewards’, name: ‘Rewards’ },
{ path: ‘/verifier’, name: ‘Verifier’ },
{ path: ‘/disputes’, name: ‘Disputes’ },
{ path: ‘/admin’, name: ‘Admin’ },
];

test.describe(‘Production canonical route smoke coverage’, () => {
for (const route of canonicalRoutes) {
test(${route.name} route responds without a server error, async ({ page }) => {
const response = await page.goto(route.path);

  expect(response, `${route.path} should return a document response`).not.toBeNull();
  expect(response!.status(), `${route.path} should not return a server error`).toBeLessThan(500);
});

}

test(‘unknown claim ID displays a not-found state’, async ({ page }) => {
await page.goto(’/claims/unknown-production-smoke-id’);

await expect(
  page.getByRole('heading', { name: /claim not found/i }),
).toBeVisible({ timeout: 10000 });

});

test(‘home page exposes the main content landmark’, async ({ page }) => {
await page.goto(’/’);

await expect(page.locator('#main-content')).toBeVisible();

});

test(‘unknown routes do not produce a server error’, async ({ page }) => {
const response = await page.goto(’/production-smoke-route-that-does-not-exist’);

expect(response).not.toBeNull();
expect(response!.status()).toBeLessThan(500);

});
});
