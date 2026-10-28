import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Manual checks hit live third-party streams, so they only run with MANUAL=1.
  testMatch: process.env.MANUAL ? '**/*.manual.ts' : '**/*.spec.ts',
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    // Branded Chrome ships H.264/AAC; bundled Chromium does not, and most live streams need them.
    channel: process.env.CI ? undefined : 'chrome',
  },
  projects: [{ name: 'desktop' }],
});
