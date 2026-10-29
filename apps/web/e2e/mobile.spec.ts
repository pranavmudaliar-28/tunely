// Runs against a live stack (pnpm dev). Phone-sized viewport.
import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test('bottom tab bar without a separate Search tab', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main' });
  const box = await nav.boundingBox();
  expect(box!.y + box!.height).toBeGreaterThan(800);
  await expect(nav.getByRole('link', { name: 'Live TV' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Search' })).toHaveCount(0);
});

test('old /search links land on Live TV with the query', async ({ page }) => {
  await page.goto('/search?q=zee');
  await expect(page).toHaveURL(/\/browse\?q=zee$/);
  await expect(page.locator('#b-q')).toHaveValue('zee');
});

test('filters fold behind a button and fit the screen', async ({ page }) => {
  await page.goto('/browse');
  await expect(page.locator('#b-country')).toBeHidden();
  await page.getByRole('button', { name: 'Filters' }).click();
  await expect(page.locator('#b-country')).toBeVisible();
  await page.locator('#b-status').selectOption('live');
  await expect(page.getByRole('button', { name: 'Filters (1)' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
