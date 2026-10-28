import { prepareTestDb } from '@tunely/db';

// Create and migrate this package's own test database (see vitest.config.ts).
export default async function setup() {
  const base = process.env.TEST_DATABASE_URL;
  if (base) await prepareTestDb(base, 'worker');
}
