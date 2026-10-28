import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export function createDb(url: string) {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  return { db: drizzle(pool, { schema }), pool };
}
export type Db = ReturnType<typeof createDb>['db'];

/** Rebuild the public directory after catalog, health or curation changes. Readers are never blocked. */
export async function refreshPublicChannels(db: Db) {
  await db.execute(sql`select refresh_public_channels()`);
}
