import { expect, test } from '@playwright/test';

test('mobile navigation contains focus and returns it on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const trigger = page.getByRole('button', { name: 'Toggle navigation menu' });
  const navigation = page.locator('#sidebar-navigation');
  await expect(navigation).toBeHidden();

  await trigger.focus();
  await trigger.press('Enter');
  await expect(navigation).toBeVisible();
  await expect(navigation).toHaveAttribute('aria-modal', 'true');
  await expect(page.getByRole('button', { name: 'Claims Feed' })).toBeFocused();

  await page.keyboard.press('Shift+Tab');
  await expect(navigation.getByRole('button', { name: 'User profile' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(navigation).toBeHidden();
  await expect(trigger).toBeFocused();
});
