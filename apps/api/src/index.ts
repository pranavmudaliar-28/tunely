import { createDb } from '@tunely/db';
import { QUEUE } from '@tunely/shared';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { buildApp } from './app';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const { db, pool } = createDb(databaseUrl);
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
const catalog = new Queue(QUEUE.catalog, { connection: redis });

const app = buildApp({ db, queues: { catalog }, adminToken: process.env.ADMIN_TOKEN });
app.addHook('onClose', async () => {
  await catalog.close();
  await redis.quit();
  await pool.end();
});

const port = Number(process.env.API_PORT ?? 4000);
await app.listen({ port, host: '0.0.0.0' });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => void app.close().then(() => process.exit(0)));
