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

test('crawlers get links, one home h1 and the right robots rules in raw HTML', async ({ request }) => {
  const html = async (path: string) => (await request.get(path)).text();
  const home = await html('/');
  expect(home.match(/<h1[\s>]/g)).toHaveLength(1);
  expect(home).toMatch(/<link rel="canonical" href="https?:\/\/[^/"]+\/?"/); // the site root
  // Listing pages carry real channel links before any JavaScript runs.
  const country = await html('/country/in');
  expect(new Set(country.match(/href="\/watch\/[^"]+"/g)).size).toBeGreaterThanOrEqual(10);
  expect(country).not.toContain('noindex');
  // Filtered directory URLs and thin facet pages are noindex.
  expect(await html('/browse?q=zee')).toMatch(/<meta name="robots" content="noindex, follow"/);
  expect(await html('/browse')).not.toContain('noindex');
  expect(await html('/language/abk')).toMatch(/<meta name="robots" content="noindex, follow"/);
  // Facet titles and descriptions carry what people search for, with live counts.
  expect(country).toMatch(/<title>India Live TV Channels List: Watch Free Online/);
  expect(country).toMatch(/<meta name="description" content="[\d,]+ TV channels from India are live now/);
});

test('the app page explains installing and is linked from the footer', async ({ page }) => {
  await page.goto('/browse');
  await page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'Get the app' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Get the free live TV app');
  await expect(page.getByRole('heading', { name: 'iPhone and iPad' })).toBeVisible();
  const types = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((els) => els.map((e) => JSON.parse(e.textContent ?? '{}')['@type']));
  expect(types).toEqual(expect.arrayContaining(['WebApplication', 'BreadcrumbList']));
});

test('home does not download the video player library until a channel is in reach', async ({ page }) => {
  const hlsLoaded: string[] = [];
  page.on('response', async (res) => {
    if (res.request().resourceType() !== 'script') return;
    const body = await res.text().catch(() => '');
    if (body.includes('fragLoadingMaxRetry')) hlsLoaded.push(res.url()); // a string only hls.js contains
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(hlsLoaded).toEqual([]);
  // Heading for a channel starts the download, so playback still starts fast.
  await page.getByRole('link', { name: 'Watch live' }).hover();
  await expect.poll(() => hlsLoaded.length).toBeGreaterThan(0);
});

test('home features the top Indian news channels', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Top Indian news channels' })).toBeVisible();
});
