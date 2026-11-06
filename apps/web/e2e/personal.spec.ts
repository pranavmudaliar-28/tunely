// Runs against a live stack (pnpm dev with a synced, health-checked catalog).
import { expect, test, type Page } from '@playwright/test';

/** Writes straight into the IndexedDB store the library uses (idb-keyval: database "tunely", store "library"). */
async function seedLibrary(page: Page, key: string, value: unknown) {
  await page.evaluate(
    ([k, v]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('tunely');
        open.onupgradeneeded = () => open.result.createObjectStore('library');
        open.onsuccess = () => {
          const tx = open.result.transaction('library', 'readwrite');
          tx.objectStore('library').put(v, k as string);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      }),
    [key, value] as const,
  );
}

const card = (id: string, name: string) => ({
  id,
  name,
  country: 'IN',
  categories: ['news'],
  languages: ['hin'],
  logo: null,
  quality: null,
  status: 'live',
});

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test('the header search button opens channel search', async ({ page }) => {
    await page.goto('/browse');
    await page.getByRole('button', { name: 'Search channels' }).click();
    const dialog = page.getByRole('dialog', { name: 'Search channels' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('combobox')).toBeFocused();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
});

test('a favorited channel shows in "Your channels" on Home', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Watch live' }).click();
  await expect(page).toHaveURL(/\/watch\//);
  const name = (await page.getByRole('heading', { level: 1 }).textContent())!;
  await page.getByRole('button', { name: 'Favorite', exact: true }).click();
  await page.goto('/');
  const rail = page.getByRole('region', { name: 'Your channels' });
  await expect(rail).toBeVisible();
  await expect(rail.getByText(name, { exact: true })).toBeVisible();
});

test('history lists what was watched; remove one, then clear all', async ({ page }) => {
  await page.goto('/history');
  await expect(page.getByText('Nothing watched yet')).toBeVisible();
  await seedLibrary(page, 'history', [
    { channel: card('A.in', 'Alpha News'), lastWatchedAt: Date.now(), watchSeconds: 7800 },
    { channel: card('B.in', 'Beta TV'), lastWatchedAt: Date.now() - 3_600_000, watchSeconds: 30 },
  ]);
  await page.reload();
  await expect(page.getByText('2 h 10 min in total')).toBeVisible();
  await page.getByRole('button', { name: 'Remove Beta TV from history' }).click();
  await expect(page.getByText('Beta TV')).toBeHidden();
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Clear history' }).click();
  await expect(page.getByText('Nothing watched yet')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Nothing watched yet')).toBeVisible();
});

test('first visit: picking a language adds its rail and the question goes away', async ({ page }) => {
  await page.goto('/');
  const welcome = page.getByRole('region', { name: 'Which languages do you watch?' });
  await expect(welcome).toBeVisible();
  const first = welcome.getByRole('group').getByRole('button').first();
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await welcome.getByRole('button', { name: 'Show my channels' }).click();
  await expect(welcome).toBeHidden();
  await expect(page.getByRole('region', { name: /^Live in / })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: /^Live in / })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Which languages do you watch?' })).toBeHidden();
});

test('settings keep the chosen country', async ({ page }) => {
  await page.goto('/settings');
  const select = page.getByLabel('Country', { exact: true });
  await select.selectOption('DE');
  await page.reload();
  await expect(page.getByLabel('Country', { exact: true })).toHaveValue('DE');
});
