import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createDb } from './client';

/**
 * Give a test suite its own database next to TEST_DATABASE_URL (e.g. tunely_test_api), created and
 * migrated on demand. Separate databases let packages run their tests in parallel.
 */
export async function prepareTestDb(baseUrl: string, suffix: string): Promise<string> {
  const url = new URL(baseUrl);
  const name = `${url.pathname.slice(1)}_${suffix}`.replace(/[^a-z0-9_]/gi, '_');
  url.pathname = `/${name}`;

  // Connect via the always-present maintenance database: the base test database may not exist (fresh CI).
  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const exists = await admin.query('select 1 from pg_database where datname = $1', [name]);
    if (!exists.rowCount) await admin.query(`create database "${name}"`);
  } finally {
    await admin.end();
  }

  const { db, pool } = createDb(url.toString());
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)) });
  await pool.end();
  return url.toString();
}
