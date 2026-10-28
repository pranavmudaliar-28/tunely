// Production migration entry (bundled to dist/migrate.js). Run before each deploy goes live.
import { runMigrations } from '@tunely/db';
import { fileURLToPath } from 'node:url';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
// From apps/<app>/dist/ back to the repo's packages/db/migrations (kept in the image).
const folder =
  process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL('../../../packages/db/migrations', import.meta.url));
await runMigrations(url, folder);
console.log('migrations applied');
