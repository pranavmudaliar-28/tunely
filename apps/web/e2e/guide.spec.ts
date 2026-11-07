// Runs against a live stack whose database has a programme guide (pnpm --filter @tunely/worker guide:once).
import { expect, test } from '@playwright/test';

test("the guide lists what's on, and Remind me saves a calendar event", async ({ page }) => {
  await page.goto('/guide');
  await expect(page.getByRole('heading', { level: 1, name: "What's on now" })).toBeVisible();
  const rows = page.getByRole('region', { name: /: on now and next$/ });
  test.skip((await rows.count()) === 0, 'no programme guide in this database');
  await expect(rows.first().getByText('Now', { exact: true })).toBeVisible();
  const remind = page.getByRole('button', { name: /^Remind me: / }).first();
  const download = page.waitForEvent('download');
  await remind.click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.ics$/);
  // The channel column opens the channel.
  await page.locator('main li a[href^="/watch/"]').first().click();
  await expect(page).toHaveURL(/\/watch\//);
});

test('channel cards say what is on now', async ({ page }) => {
  await page.goto('/guide');
  const name = await page.locator('main li a[href^="/watch/"] span.truncate').first().textContent();
  test.skip(!name, 'no programme guide in this database');
  await page.goto(`/browse?q=${encodeURIComponent(name!)}`);
  await expect(page.locator('a[data-nav][href^="/watch/"]').filter({ hasText: name! }).first()).toContainText(
    'Now: ',
  );
});
