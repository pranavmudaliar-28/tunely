// Run one catalog sync now, without Redis: pnpm --filter @tunely/worker sync:once
import { dbFromEnv } from '../src/db';
import { runCatalogSync } from '../src/jobs/catalog-sync';

const { db, pool } = dbFromEnv();
const started = Date.now();
const counts = await runCatalogSync(db);
console.log(JSON.stringify(counts, null, 2));
console.log(`done in ${((Date.now() - started) / 1000).toFixed(1)} s`);
await pool.end();
