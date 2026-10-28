// Runs against a live stack (pnpm dev with a synced, health-checked, curated catalog).
import { expect, test, type Page } from '@playwright/test';

const playerSettled = (page: Page) =>
  expect(page.locator('[data-testid^="player-error-"], video').filter({ visible: true }).first()).toBeVisible(
    { timeout: 15_000 },
  );

test('home → play in at most 2 clicks → switch channel', async ({ page }) => {
  await page.goto('/');
  // Click 1: "Watch live" on the hero. Video starts without another click.
  await page.getByRole('link', { name: 'Watch live' }).click();
  await expect(page).toHaveURL(/\/watch\//);
  const firstUrl = page.url();
  const firstTitle = await page.getByRole('heading', { level: 1 }).textContent();
  await playerSettled(page);
  // The player leaves the loading state: playing, or a clear error with a next step.
  await expect(page.getByTestId('player-loading')).toBeHidden({ timeout: 15_000 });
  const errorOverlay = page.locator('[data-testid^="player-error-"]');
  if (await errorOverlay.isVisible()) {
    await expect(errorOverlay.getByRole('button', { name: 'Try next channel' })).toBeVisible();
  } else {
    await expect
      .poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 15_000 })
      .toBeGreaterThan(0);
  }

  // Channel down with the keyboard.
  await page
    .locator('body')
    .click({ position: { x: 5, y: 5 } })
    .catch(() => {});
  await page.keyboard.press('ArrowDown');
  await expect(page).not.toHaveURL(firstUrl);
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(firstTitle ?? '');

  // And back up.
  await page.keyboard.press('ArrowUp');
  await expect(page).toHaveURL(firstUrl);
});

test('channel cards are reachable by keyboard with a visible focus ring', async ({ page }) => {
  await page.goto('/browse');
  const firstCard = page.getByRole('listitem').first().getByRole('link');
  await firstCard.focus();
  await expect(firstCard).toBeFocused();
  const outline = await firstCard.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/watch\//);
});

test('Ctrl+K search opens a channel', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  const box = page.getByRole('combobox', { name: 'Search channels' });
  await expect(box).toBeFocused();
  await box.fill('news');
  await expect(page.getByRole('option').first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/watch\//);
});

test('favorites persist across reloads without an account', async ({ page }) => {
  await page.goto('/browse');
  const fav = page.getByRole('button', { name: /^Add .* to favorites$/ }).first();
  const label = (await fav.getAttribute('aria-label'))!;
  const name = label.replace(/^Add (.*) to favorites$/, '$1');
  await fav.click();
  await page.goto('/favorites');
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
});
