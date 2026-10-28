// Manual Phase 2 acceptance check, not part of CI (it depends on live third-party streams):
//   MANUAL=1 pnpm --filter @tunely/web e2e
// Needs `pnpm dev` running and a health-checked catalog.
import { expect, test } from '@playwright/test';

test('at least 80% of 50 sampled web_playable streams play', async ({ page }) => {
  test.setTimeout(20 * 60_000);
  await page.goto('/dev/stream-test');
  const rate = page.getByTestId('success-rate');
  await expect(rate).toContainText(/of (\d+)\)/);
  await expect
    .poll(
      async () => {
        const m = /\((\d+)\/(\d+) of (\d+)\)/.exec((await rate.textContent()) ?? '');
        return m ? m[2] === m[3] : false;
      },
      { timeout: 18 * 60_000, intervals: [5000] },
    )
    .toBe(true);
  const text = (await rate.textContent()) ?? '';
  console.log('stream-test result:', text);
  expect(Number(text.split('%')[0])).toBeGreaterThanOrEqual(80);
});
