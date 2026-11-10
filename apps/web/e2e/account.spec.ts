// Needs the web server started with BETTER_AUTH_SECRET, DATABASE_URL and AUTH_DEV_MAILBOX=1 (links are kept for the
// test instead of emailed). Skips when accounts are off.
import { expect, test, type Page } from '@playwright/test';

test('a favorite follows you to another browser after signing in; the account can be deleted', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const email = `e2e-${Date.now()}@example.com`;
  const signIn = async (page: Page) => {
    await page.goto('/account');
    const box = page.getByLabel('Email');
    test.skip((await box.count()) === 0, 'accounts are off in this build');
    await box.fill(email);
    await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
    await expect(page.getByText(/^Check your inbox/)).toBeVisible();
    const { url } = (await (
      await page.request.get(`/api/dev/mailbox?email=${encodeURIComponent(email)}`)
    ).json()) as { url: string };
    await page.goto(url);
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText(/^Signed in as/)).toBeVisible();
    await expect(page.getByText(/^Synced\./)).toBeVisible({ timeout: 20_000 });
  };

  // Browser A: a favorite saved without an account, then the first sign-in uploads it.
  const a = await (await browser.newContext()).newPage();
  await a.goto('/browse');
  const add = a.getByRole('button', { name: /^Add .* to favorites$/ }).first();
  const name = (await add.getAttribute('aria-label'))!.replace(/^Add (.*) to favorites$/, '$1');
  const saved = a.getByRole('button', { name: `Remove ${name} from favorites` }).first();
  await expect(async () => {
    if (await add.isVisible()) await add.click();
    await expect(saved).toBeVisible({ timeout: 1000 });
  }).toPass();
  await signIn(a);

  // Browser B: nothing stored; signing in brings the favorite.
  const b = await (await browser.newContext()).newPage();
  await signIn(b);
  await b.goto('/favorites');
  await expect(b.getByText(name, { exact: true }).first()).toBeVisible();

  // Deleting the account signs out; the browser keeps its copy.
  await b.goto('/account');
  await b.getByRole('button', { name: 'Delete my account' }).click();
  await b.getByRole('button', { name: 'Delete account' }).click();
  await expect(b.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible();
  await b.goto('/favorites');
  await expect(b.getByText(name, { exact: true }).first()).toBeVisible();
});
