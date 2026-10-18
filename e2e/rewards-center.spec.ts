import { test, expect } from '@playwright/test';

const stories = [
  {
    id: 'compositions-rewards-center--dark',
    title: 'Rewards and transaction recovery',
    name: 'rewards-dark',
  },
  {
    id: 'compositions-rewards-center--large-exact-amount',
    title: 'Rewards and transaction recovery',
    name: 'rewards',
  },
  {
    id: 'compositions-transaction-center--reload-recovery',
    title: 'Transaction center',
    name: 'transactions',
  },
];

for (const width of [1440, 768, 390]) {
  for (const story of stories) {
    test(story.name + ' reflows at ' + width, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/iframe.html?id=' + story.id + '&viewMode=story');
      await expect(
        page.getByRole('heading', { name: story.title, exact: true }),
      ).toBeVisible();
      const section = page.getByRole('region', {
        name: story.name.startsWith('rewards')
          ? 'Rewards center'
          : 'Transaction center',
        exact: true,
      });
      await expect(section).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(section).toHaveScreenshot(
        story.name + '-' + width + '.png',
        { animations: 'disabled' },
      );
    });
  }
}

test('200% zoom reflows without clipping and preserves keyboard focus and reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.goto(
    '/iframe.html?id=compositions-rewards-center--all-outcomes&viewMode=story',
  );
  await expect(
    page.getByRole('heading', { name: 'Rewards and transaction recovery' }),
  ).toBeVisible();
  // A 1536px display at 200% browser zoom has a 768 CSS-pixel viewport.
  // Text enlargement is checked independently as well.
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const filter = page.getByRole('combobox', { name: 'Outcome' });
  await filter.focus();
  await expect(filter).toBeFocused();
  const outline = await filter.evaluate(
    (element) => getComputedStyle(element).outlineWidth,
  );
  expect(parseFloat(outline)).toBeGreaterThanOrEqual(2);
  await filter.selectOption('slashed');
  await expect(
    page.getByRole('heading', { name: 'Slashed stake' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Review withdrawal' }),
  ).toBeDisabled();
  const motion = await filter.evaluate((element) => ({
    animation: getComputedStyle(element).animationName,
    transition: getComputedStyle(element).transitionDuration,
  }));
  expect(motion.animation).toBe('none');
  expect(motion.transition).toBe('0s');
});

test('forced colours preserve active navigation and recovery links', async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto(
    '/iframe.html?id=compositions-transaction-center--replaced&viewMode=story',
  );
  const details = page.getByText('Recovery details for Withdraw 12.00 USDC');
  await expect(details).toBeVisible();
  // Story play may have opened the native disclosure already.
  const replacement = page.getByRole('link', { name: /Follow replacement/ });
  if (!(await replacement.isVisible())) await details.click();
  await expect(replacement).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Transactions', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});
