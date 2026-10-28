import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { env: loadEnv(), fileParallelism: false },
});

function loadEnv() {
  try {
    process.loadEnvFile('../../.env');
  } catch {
    // CI sets env vars directly.
  }
  return { TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? '' };
}
