// Check every due stream now, without Redis: pnpm --filter @tunely/worker health:once [--limit N] [--concurrency N]
import { parseArgs } from 'node:util';
import { dbFromEnv } from '../src/db';
import { runHealthBatch } from '../src/jobs/health';

const { values } = parseArgs({ options: { limit: { type: 'string' }, concurrency: { type: 'string' } } });
const { db, pool } = dbFromEnv();
const started = Date.now();
const res = await runHealthBatch(db, {
  limit: Number(values.limit ?? 100_000),
  concurrency: Number(values.concurrency ?? 60),
});
console.log(JSON.stringify(res), `done in ${((Date.now() - started) / 1000).toFixed(0)} s`);
await pool.end();
