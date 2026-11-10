// Runs against a live stack (pnpm dev with a synced, health-checked catalog).
import { expect, test } from '@playwright/test';

test('multi-view: pick two channels, switch the sound, remove one', async ({ page, request }) => {
  const api = process.env.E2E_API_URL ?? 'http://localhost:4000';
  const key = process.env.INTERNAL_API_KEY;
  const res = await request.get(`${api}/v1/channels?status=live&sort=best&limit=2`, {
    headers: key ? { 'x-internal-key': key } : {},
  });
  const [a, b] = ((await res.json()) as { items: { id: string; name: string }[] }).items;
  test.skip(!a || !b, 'needs two live channels');

  await page.goto('/multiview');
  for (const ch of [a!, b!]) {
    await page.getByRole('button', { name: 'Add a channel' }).click();
    const dialog = page.getByRole('dialog', { name: 'Pick a channel' });
    await dialog.getByRole('searchbox', { name: 'Search live channels' }).fill(ch.name);
    await dialog.getByRole('button', { name: ch.name, exact: true }).first().click();
    await expect(page.getByRole('region', { name: ch.name, exact: true })).toBeVisible();
  }
  await expect(page).toHaveURL(new RegExp(`c=${encodeURIComponent(a!.id)},${encodeURIComponent(b!.id)}`));
  const tileA = page.getByRole('region', { name: a!.name, exact: true });
  const tileB = page.getByRole('region', { name: b!.name, exact: true });
  await expect(tileA.getByRole('button', { name: 'Sound on' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('2');
  await expect(tileB.getByRole('button', { name: 'Sound on' })).toBeVisible();
  await expect(tileA.getByRole('button', { name: 'Listen' })).toHaveAttribute('aria-pressed', 'false');
  await tileA.getByRole('button', { name: `Remove ${a!.name}` }).click();
  await expect(tileA).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`c=${encodeURIComponent(b!.id)}$`));
});

test('the watch page opens multi-view with that channel', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Watch live' }).click();
  await expect(page).toHaveURL(/\/watch\//);
  const name = (await page.getByRole('heading', { level: 1 }).textContent())!;
  await page.getByRole('link', { name: 'Multi-view' }).click();
  await expect(page.getByRole('region', { name, exact: true })).toBeVisible();
});
