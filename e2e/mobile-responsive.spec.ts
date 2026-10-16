import { test, expect, type Page } from '@playwright/test';

/**
 * V2-FE-128 — Mobile responsiveness of every protocol workflow.
 *
 * Runs against the production build at a 375×812 phone viewport and asserts:
 *  - no horizontal (page-level) overflow on any workflow route;
 *  - primary protocol actions (wallet, submit claim) stay reachable and are
 *    never covered by the fixed mobile navigation button;
 *  - the mobile navigation drawer opens, closes and restores focus;
 *  - modal dialogs fit within the viewport;
 *  - failure states remain visible and recoverable on narrow screens.
 *
 * Genuine data tables scroll horizontally inside their own labelled scroll
 * region; that region-scoped scrolling must not leak to the document.
 */

const MOBILE_VIEWPORT = { width: 375, height: 812 };

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
}

function intersects(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

test.describe('V2-FE-128 mobile responsive protocol workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
  });

  test('dashboard: no horizontal overflow and primary actions reachable', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.locator('header[role="banner"]')).toBeVisible();
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.getByText('Claimable Rewards')).toBeVisible();

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    // Primary actions are always visible on phones.
    const submit = page.getByRole('button', { name: 'Submit a new claim' });
    await expect(submit).toBeVisible();

    // Feed filters and secondary indicators collapse below the sm
    // breakpoint so the header never overflows.
    await expect(page.locator('#chain-select')).toBeHidden();

    // The fixed hamburger button must never overlap primary actions.
    const hamburger = page.getByRole('button', {
      name: /toggle navigation menu/i,
    });
    const hamburgerBox = await hamburger.boundingBox();
    const submitBox = await submit.boundingBox();
    expect(hamburgerBox).not.toBeNull();
    expect(submitBox).not.toBeNull();
    expect(intersects(hamburgerBox!, submitBox!)).toBe(false);
  });

  test('mobile navigation: opens, closes with Escape and restores focus', async ({
    page,
  }) => {
    await page.goto('/');

    const hamburger = page.getByRole('button', {
      name: /toggle navigation menu/i,
    });
    await expect(hamburger).toBeVisible();
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false');

    await hamburger.click();
    await expect(hamburger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('div[role="presentation"]')).toBeVisible();
    await expect(
      page.getByTestId('sidebar-pending-transactions')
    ).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    await page.keyboard.press('Escape');
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('div[role="presentation"]')).toHaveCount(0);
    await expect(hamburger).toBeFocused();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('submit claim modal fits the mobile viewport and closes with Escape', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Submit a new claim' }).click();

    const modal = page.getByTestId('claim-submission-modal');
    await expect(modal).toBeVisible();

    const panel = modal.locator('form');
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
  });

  test('claim verification route fails closed on unknown claims without overflow', async ({
    page,
  }) => {
    await page.goto('/claims/responsive-e2e-missing');

    // The API projection has no such claim: the documented failure state is
    // shown instead of fabricated verification UI, and it stays usable on a
    // phone viewport.
    await expect(
      page.getByRole('heading', { name: /claim not found/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /go back/i })
    ).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('identity verification workflow fits the mobile viewport', async ({
    page,
  }) => {
    await page.goto('/identity');

    await expect(
      page.getByRole('heading', { name: /step 1: connect wallet/i })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /step 2: verify identity/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /connect wallet/i }).first()
    ).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('how-it-works guidance fits the mobile viewport', async ({ page }) => {
    await page.goto('/how-it-works');

    await expect(
      page.getByRole('heading', { level: 1, name: /turn information into/i })
    ).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});
