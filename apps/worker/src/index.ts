import { JOB, QUEUE } from '@tunely/shared';
import { Queue, Worker } from 'bullmq';
import { pino } from 'pino';
import { dbFromEnv } from './db';
import { runCatalogSync } from './jobs/catalog-sync';
import { createRedis } from './redis';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const connection = createRedis();
const { db, pool } = dbFromEnv();

const catalogQueue = new Queue(QUEUE.catalog, { connection });
// Daily at 02:30 UTC. upsertJobScheduler is idempotent across restarts.
await catalogQueue.upsertJobScheduler(
  'daily-catalog-sync',
  { pattern: '30 2 * * *', tz: 'UTC' },
  { name: JOB.catalogSync },
);

const catalogWorker = new Worker(
  QUEUE.catalog,
  async (job) => {
    if (job.name !== JOB.catalogSync) return;
    const counts = await runCatalogSync(db);
    log.info({ counts }, 'catalog sync finished');
    return counts;
  },
  { connection, concurrency: 1 },
);
catalogWorker.on('failed', (job, err) => log.error({ job: job?.id, err }, 'catalog sync failed'));

log.info('worker started');

const shutdown = async () => {
  await catalogWorker.close();
  await catalogQueue.close();
  await pool.end();
  await connection.quit();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
