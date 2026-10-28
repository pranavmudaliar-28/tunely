import { createDb } from '@tunely/db';
import { QUEUE } from '@tunely/shared';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { buildApp } from './app';

const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
};

const { db, pool } = createDb(env('DATABASE_URL'));
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
const catalog = new Queue(QUEUE.catalog, { connection: redis });
const corsOrigins = (process.env.CORS_ORIGINS ?? process.env.NEXT_PUBLIC_SITE_URL ?? '')
  .split(',')
  .filter(Boolean);

const app = buildApp({
  db,
  redis,
  queues: { catalog },
  adminToken: process.env.ADMIN_TOKEN,
  reportHashSecret: env('REPORT_HASH_SECRET'),
  corsOrigins,
  trustProxy: process.env.TRUST_PROXY === 'true',
});
app.addHook('onClose', async () => {
  await catalog.close();
  await redis.quit();
  await pool.end();
});

const port = Number(process.env.API_PORT ?? 4000);
await app.listen({ port, host: '0.0.0.0' });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => void app.close().then(() => process.exit(0)));
