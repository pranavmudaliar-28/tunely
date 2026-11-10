// Needs a build with NEXT_PUBLIC_VAPID_PUBLIC_KEY and a programme guide; Chrome subscribes through Google's push service.
import { chromium, expect, test } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('Notify me subscribes this browser; Settings turns it off again', async ({ baseURL }) => {
  test.setTimeout(120_000); // a new profile first registers with the push service
  // Chrome refuses push subscriptions in throwaway (incognito-like) contexts: use a real profile.
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'tunely-push-')), {
    channel: 'chrome',
    headless: true,
    baseURL,
  });
  try {
    await context.grantPermissions(['notifications'], { origin: baseURL });
    const page = await context.newPage();
    await page.goto('/guide');
    // Both buttons appear once the page has hydrated.
    await page.getByRole('button', { name: /^Remind me: / }).first().waitFor();
    const notify = page.getByRole('button', { name: /^Notify me before / }).first();
    test.skip((await notify.count()) === 0, 'push not configured in this build');
    await notify.click();
    await expect(page.getByRole('button', { name: /^Notification set for / }).first()).toBeVisible({
      timeout: 60_000,
    });

    await page.goto('/settings');
    const status = page.getByRole('region', { name: 'Notifications' }).getByRole('status');
    await expect(status).toContainText('On in this browser');
    await page.getByRole('button', { name: 'Turn off and forget what I asked for' }).click();
    await expect(status).toContainText('Off.');
    const sub = await page.evaluate(async () =>
      (await navigator.serviceWorker.ready).pushManager.getSubscription().then((s) => s?.endpoint ?? null),
    );
    expect(sub).toBeNull();
  } finally {
    await context.close();
  }
});
