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

test('voice search fills the box with what was said', async ({ page }) => {
  // A stand-in for the browser's speech recogniser: "hears" sun tv right after start.
  await page.addInitScript(() => {
    class FakeRecognition {
      lang = '';
      interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        setTimeout(() => {
          this.onresult?.({ results: [[{ transcript: 'sun tv' }]] });
          this.onend?.();
        }, 50);
      }
      stop() {
        this.onend?.();
      }
      abort() {
        this.onend?.();
      }
    }
    const w = window as unknown as Record<string, unknown>;
    w.SpeechRecognition = w.webkitSpeechRecognition = FakeRecognition;
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Search channels' }).click();
  await page.getByRole('button', { name: 'Search by voice' }).click();
  await expect(page.getByRole('combobox', { name: 'Search channels' })).toHaveValue('sun tv');
  await expect(page.getByRole('button', { name: 'Search by voice' })).toBeVisible(); // stopped listening
});

test('touch player: big middle controls, tap to hide and show, settings behind the gear', async ({
  page,
}) => {
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
  await page.goto('/');
  await page.getByRole('link', { name: 'Watch live' }).click();
  const player = page.locator('section[data-hydrated]');
  await player.waitFor();
  await expect(page.getByTestId('player-loading')).toBeHidden({ timeout: 15_000 });
  test.skip(await page.locator('[data-testid^="player-error-"]').isVisible(), 'stream offline right now');

  const pause = player.getByRole('button', { name: 'Pause' });
  await expect(pause).toBeVisible({ timeout: 15_000 });
  await expect(player.getByRole('button', { name: 'Next channel' })).toBeVisible();
  await expect(player.getByLabel('Volume')).toHaveCount(0); // phones have volume buttons
  const video = (await player.locator('video').boundingBox())!;
  const mid = (await pause.boundingBox())!;
  expect(Math.abs(mid.y + mid.height / 2 - (video.y + video.height / 2))).toBeLessThan(8);

  // Tap the picture (away from the buttons): controls hide; tap again: back.
  const layer = pause.locator('..');
  await player.locator('video').tap({ position: { x: 20, y: video.height / 2 } });
  await expect(layer).toHaveClass(/opacity-0/);
  await page.waitForTimeout(400); // not a double tap
  await player.locator('video').tap({ position: { x: 20, y: video.height / 2 } });
  await expect(layer).not.toHaveClass(/opacity-0/);

  const gear = player.getByRole('button', { name: 'Settings' });
  if (await gear.isVisible()) {
    await gear.click();
    await expect(player.getByRole('group', { name: 'Player settings' }).getByLabel('Quality')).toBeVisible();
    await player.locator('video').tap({ position: { x: 20, y: video.height / 2 } });
    await expect(player.getByRole('group', { name: 'Player settings' })).toHaveCount(0);
  }
});
