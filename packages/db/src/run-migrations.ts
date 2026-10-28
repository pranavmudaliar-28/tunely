import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './client';

/** Apply every pending migration in `folder` and close the connection. */
export async function runMigrations(url: string, folder: string) {
  const { db, pool } = createDb(url);
  try {
    await migrate(db, { migrationsFolder: folder });
  } finally {
    await pool.end();
  }
}
