import { refreshPublicChannels } from '@tunely/db';
import { sql } from 'drizzle-orm';
import { JOB, QUEUE } from '@tunely/shared';
import { Queue, Worker, type Processor } from 'bullmq';
import { pino } from 'pino';
import { config } from './config';
import { dbFromEnv } from './db';
import { runCatalogSync } from './jobs/catalog-sync';
import { pruneChecks, rescore, runHealthBatch } from './jobs/health';
import { flushReports } from './jobs/reports';
import { createRedis } from './redis';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const connection = createRedis();
const { db, pool } = dbFromEnv();

const catalogQueue = new Queue(QUEUE.catalog, { connection });
const healthQueue = new Queue(QUEUE.health, { connection });
const reportsQueue = new Queue(QUEUE.reports, { connection });
// upsertJobScheduler is idempotent across restarts.
await catalogQueue.upsertJobScheduler(
  'daily-catalog-sync',
  { pattern: '30 2 * * *', tz: 'UTC' },
  { name: JOB.catalogSync },
);
// 1000 streams every 15 min checks ~16k streams within the 4 h recheck window.
// A fresh database (first deploy) gets its catalog now instead of at the next 02:30 UTC run.
const [first] = (await db.execute<{ count: number }>(sql`select count(*)::int as count from channels`)).rows;
if (first?.count === 0) {
  log.info('empty catalog: running the first sync now');
  await catalogQueue.add(JOB.catalogSync, {}, { jobId: 'initial-sync', removeOnComplete: true });
}
await healthQueue.upsertJobScheduler(
  'health-batch',
  { every: config.healthBatchEveryMin * 60_000 },
  { name: JOB.healthBatch },
);
await reportsQueue.upsertJobScheduler(
  'flush-reports',
  { every: 10_000 },
  { name: JOB.flushReports, opts: { removeOnComplete: true, removeOnFail: 100 } },
);
await healthQueue.upsertJobScheduler(
  'health-score',
  { every: config.healthScoreEveryMin * 60_000 },
  { name: JOB.healthScore },
);

const handlers: Record<string, Processor> = {
  [JOB.catalogSync]: () => runCatalogSync(db),
  [JOB.healthBatch]: () => runHealthBatch(db, { limit: config.healthBatchSize }),
  [JOB.flushReports]: async () => ({ inserted: await flushReports(db, connection) }),
  [JOB.healthScore]: async () => {
    await pruneChecks(db);
    const rescored = await rescore(db);
    await refreshPublicChannels(db);
    return { rescored };
  },
};

const process_: Processor = async (job, token) => {
  const handler = handlers[job.name];
  if (!handler) throw new Error(`unknown job ${job.name}`);
  const started = Date.now();
  const result = await handler(job, token);
  if (job.name !== JOB.flushReports)
    log.info({ job: job.name, ms: Date.now() - started, result }, 'job finished');
  return result;
};

const workers = [
  new Worker(QUEUE.catalog, process_, { connection, concurrency: 1 }),
  // Health batches must not overlap: the "due" query would hand both the same streams.
  new Worker(QUEUE.health, process_, { connection, concurrency: 1, lockDuration: 10 * 60_000 }),
  new Worker(QUEUE.reports, process_, { connection, concurrency: 1 }),
];
for (const w of workers) w.on('failed', (job, err) => log.error({ job: job?.name, err }, 'job failed'));

log.info('worker started');

const shutdown = async () => {
  await Promise.all(workers.map((w) => w.close()));
  await Promise.all([catalogQueue.close(), healthQueue.close(), reportsQueue.close()]);
  await pool.end();
  await connection.quit();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
