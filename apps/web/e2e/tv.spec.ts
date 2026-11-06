// Runs against a live stack (pnpm dev with a synced, health-checked catalog).
import { expect, test, type Page } from '@playwright/test';

async function openWatchPage(page: Page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Watch live' }).click();
  await expect(page).toHaveURL(/\/watch\//);
  await page.locator('section[data-hydrated]').waitFor();
  // Focus off the link, so keys go to the player.
  await page
    .locator('body')
    .click({ position: { x: 5, y: 5 } })
    .catch(() => {});
}

test('G opens the channel list on the playing channel; arrows move, Esc closes', async ({ page }) => {
  await openWatchPage(page);
  const name = (await page.getByRole('heading', { level: 1 }).textContent())!;
  await page.keyboard.press('g');
  const list = page.getByRole('navigation', { name: 'Channels' });
  await expect(list).toBeVisible();
  const current = list.locator('a[aria-current="true"]');
  await expect(current).toContainText(name);
  await expect(current).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(current).not.toBeFocused(); // moved within the list, didn't change channel
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();
  await expect(page.getByRole('button', { name: 'Channel list' })).toBeFocused();
});

test('? lists the shortcuts', async ({ page }) => {
  await openWatchPage(page);
  await page.keyboard.press('?');
  const dialog = page.getByRole('dialog', { name: 'Keyboard and remote shortcuts' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Last channel you watched')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('arrow keys move between channel cards like a TV remote', async ({ page }) => {
  await page.goto('/browse');
  const cards = page.locator('a[data-nav][href^="/watch/"]');
  await cards.first().focus();
  const before = await cards.first().boundingBox();
  await page.keyboard.press('ArrowRight');
  const focused = page.locator('a[data-nav][href^="/watch/"]:focus');
  await expect(focused).toHaveCount(1);
  const after = await focused.boundingBox();
  expect(after!.x).toBeGreaterThan(before!.x);
  await page.keyboard.press('ArrowDown');
  const below = await page.locator('a[data-nav]:focus').boundingBox();
  expect(below!.y).toBeGreaterThan(after!.y);
});

test('the search palette understands a category', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Search channels' }).fill('news');
  await expect(page.getByText(/^Showing News$/)).toBeVisible();
  await expect(page.getByRole('option').first()).toBeVisible();
});

test('Browse offers the filters a search names', async ({ page }) => {
  await page.goto('/browse?q=news');
  await page.getByRole('button', { name: /Looking for News channels\? Show them/ }).click();
  await expect(page).toHaveURL(/category=news/);
  await expect(page).not.toHaveURL(/q=/);
});

test('data saver choice is kept', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Always on' }).check();
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Always on' })).toBeChecked();
});
