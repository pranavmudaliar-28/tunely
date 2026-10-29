// Runs against a live stack. What AdSense reviewers and search engines look for.
import { expect, test } from '@playwright/test';

test('trust pages are linked from the footer and have content', async ({ page }) => {
  await page.goto('/browse');
  const footer = page.getByRole('navigation', { name: 'Site' });
  for (const name of ['About', 'Privacy', 'Terms', 'Contact', 'Copyright / DMCA']) {
    await expect(footer.getByRole('link', { name })).toBeVisible();
  }
  await footer.getByRole('link', { name: 'Privacy' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy policy');
  await expect(
    page.getByText('adssettings.google.com').or(page.getByRole('link', { name: 'Google Ads Settings' })),
  ).toBeVisible();
});

test('a live watch page has descriptive text and channel structured data', async ({ page }) => {
  await page.goto('/browse?status=live');
  await page.getByRole('listitem').first().getByRole('link').first().click();
  await expect(page).toHaveURL(/\/watch\//);
  await expect(page.getByText(/is a TV channel from/)).toBeVisible();
  const types = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((els) => els.map((e) => JSON.parse(e.textContent ?? '{}')['@type']));
  expect(types).toEqual(expect.arrayContaining(['TelevisionChannel', 'BreadcrumbList']));
});
