// Fetch the programme guide now: pnpm --filter @tunely/worker guide:once
import { dbFromEnv } from '../src/db';
import { runGuide } from '../src/jobs/guide';
import { createRedis } from '../src/redis';

const { db, pool } = dbFromEnv();
const redis = createRedis();
const started = Date.now();
const res = await runGuide(db, redis);
const mb = Math.round(process.memoryUsage().rss / 1024 / 1024);
console.log(
  JSON.stringify(res, null, 2),
  `done in ${((Date.now() - started) / 1000).toFixed(0)} s, rss ${mb} MB`,
);
await pool.end();
redis.disconnect();
