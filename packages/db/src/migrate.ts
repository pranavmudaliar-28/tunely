import { config } from 'dotenv';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { createDb } from './client';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
const url = process.argv[2] ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const { db, pool } = createDb(url);
await migrate(db, { migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)) });
await pool.end();
console.log('migrations applied');
