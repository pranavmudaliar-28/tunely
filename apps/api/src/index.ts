import { createDb } from '@tunely/db';
import { QUEUE } from '@tunely/shared';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { buildApp } from './app';
import { REDIS_OPTIONS } from './cache';
import { parseOrigins } from './cors';

const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
};

const { db, pool } = createDb(env('DATABASE_URL'));
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', REDIS_OPTIONS);
const catalog = new Queue(QUEUE.catalog, { connection: redis });
const corsOrigins = parseOrigins(process.env.CORS_ORIGINS ?? process.env.NEXT_PUBLIC_SITE_URL);

const app = buildApp({
  db,
  redis,
  queues: { catalog },
  adminToken: process.env.ADMIN_TOKEN,
  reportHashSecret: env('REPORT_HASH_SECRET'),
  corsOrigins,
  trustProxy: process.env.TRUST_PROXY === 'true',
  internalApiKey: process.env.INTERNAL_API_KEY?.trim() || undefined,
});
app.addHook('onClose', async () => {
  await catalog.close();
  await redis.quit();
  await pool.end();
});

// Hosts like Railway assign PORT; API_PORT is for local dev.
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
// '::' is dual-stack: IPv4 and IPv6. With 0.0.0.0, "localhost" first tries ::1 and costs ~200 ms per request on Windows.
await app.listen({ port, host: process.env.API_HOST ?? '::' });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => void app.close().then(() => process.exit(0)));
