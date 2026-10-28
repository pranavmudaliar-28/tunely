import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { env: loadEnv(), fileParallelism: false, globalSetup: ['./vitest.global-setup.ts'] },
});

function loadEnv() {
  try {
    process.loadEnvFile('../../.env');
  } catch {
    // CI sets env vars directly.
  }
  const base = process.env.TEST_DATABASE_URL;
  return {
    // Own database per package (created by the global setup), so turbo can run packages in parallel.
    TEST_DATABASE_URL: base ? base.replace(/\/([^/?]+)(\?|$)/, '/$1_worker$2') : '',
    REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  };
}
