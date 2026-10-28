// Latency of cached catalog endpoints through the full Fastify stack (real Postgres + Redis):
//   pnpm --filter @tunely/api bench
import { createDb } from '@tunely/db';
import { Redis } from 'ioredis';
import { buildApp } from '../src/app';

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { db: 13 });
await redis.flushdb();
const app = buildApp({
  db,
  redis,
  queues: { catalog: { add: async () => ({}) } as never },
  adminToken: undefined,
  reportHashSecret: 'x',
  rateLimitPerMin: 1e9,
});

const urls = [
  '/v1/channels',
  '/v1/channels?country=IN',
  '/v1/channels?category=news&language=eng',
  '/v1/channels?q=news',
  '/v1/countries',
  '/v1/categories',
  '/v1/languages',
  '/v1/trending',
];
for (const url of urls) {
  const cold = performance.now();
  await app.inject({ url });
  const coldMs = performance.now() - cold;
  const times: number[] = [];
  for (let i = 0; i < 300; i++) {
    const t = performance.now();
    const res = await app.inject({ url });
    times.push(performance.now() - t);
    if (res.statusCode !== 200) throw new Error(`${url}: ${res.statusCode}`);
  }
  times.sort((a, b) => a - b);
  const p = (q: number) => times[Math.floor(q * (times.length - 1))]!.toFixed(1);
  console.log(
    `${url.padEnd(44)} cold ${coldMs.toFixed(0).padStart(4)} ms   cached p50 ${p(0.5)} ms  p95 ${p(0.95)} ms`,
  );
}
await app.close();
await redis.quit();
await pool.end();
