import { refreshPublicChannels } from '@tunely/db';
import { sql } from 'drizzle-orm';
import { JOB, QUEUE, WORKER_HEARTBEAT_EVERY_S, WORKER_HEARTBEAT_KEY, WORKER_JOBS_KEY } from '@tunely/shared';
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

// Catch-up: while some streams have never been checked (fresh database, new catalog entries), run the
// next batch right away instead of waiting for the regular schedule, so a new deploy goes live in
// minutes rather than hours. Steady state falls back to HEALTH_BATCH_EVERY_MIN.
async function scheduleCatchUp() {
  const [row] = (
    await db.execute<{ n: number }>(
      sql`select count(*)::int as n from streams s left join stream_health h on h.stream_id = s.id where h.stream_id is null`,
    )
  ).rows;
  if (!row?.n) return;
  log.info({ unchecked: row.n }, 'unchecked streams: running another health batch now');
  await healthQueue.add(JOB.healthBatch, {}, { delay: 5_000, removeOnComplete: true, removeOnFail: 20 });
}

const handlers: Record<string, Processor> = {
  [JOB.catalogSync]: async () => {
    const counts = await runCatalogSync(db);
    await scheduleCatchUp(); // new streams have never been checked
    return counts;
  },
  [JOB.healthBatch]: async () => {
    const result = await runHealthBatch(db, { limit: config.healthBatchSize });
    await scheduleCatchUp();
    return result;
  },
  [JOB.flushReports]: async () => {
    const { inserted, streamIds } = await flushReports(db, connection);
    if (!streamIds.length) return { inserted };
    // Viewers' plays can make a channel live (or not) right away: rescore just those streams, and
    // rebuild the public directory only if a status actually changed.
    const { changed } = await rescore(db, streamIds);
    if (changed) await refreshPublicChannels(db);
    return { inserted, changed };
  },
  [JOB.healthScore]: async () => {
    await pruneChecks(db);
    const { scored: rescored } = await rescore(db);
    await refreshPublicChannels(db);
    return { rescored };
  },
};

const process_: Processor = async (job, token) => {
  const handler = handlers[job.name];
  if (!handler) throw new Error(`unknown job ${job.name}`);
  const started = Date.now();
  if (job.name !== JOB.flushReports)
    void connection.hset(WORKER_JOBS_KEY, `${job.name}:running`, new Date().toISOString()).catch(() => {});
  const record = (entry: Record<string, unknown>) =>
    connection
      .hset(
        WORKER_JOBS_KEY,
        job.name,
        JSON.stringify({ at: new Date().toISOString(), ms: Date.now() - started, ...entry }),
      )
      .catch(() => {});
  try {
    const result = await handler(job, token);
    if (job.name !== JOB.flushReports) {
      log.info({ job: job.name, ms: Date.now() - started, result }, 'job finished');
      await record({ ok: true, result });
    }
    return result;
  } catch (err) {
    await record({ ok: false, error: String(err).slice(0, 300) });
    throw err;
  }
};

const workers = [
  new Worker(QUEUE.catalog, process_, { connection, concurrency: 1 }),
  // Health batches must not overlap: the "due" query would hand both the same streams.
  new Worker(QUEUE.health, process_, { connection, concurrency: 1, lockDuration: 10 * 60_000 }),
  new Worker(QUEUE.reports, process_, { connection, concurrency: 1 }),
];
for (const w of workers) w.on('failed', (job, err) => log.error({ job: job?.name, err }, 'job failed'));

// Heartbeat in Redis (not Postgres, so the free database can sleep): read by /v1/health/details.
const beat = () =>
  void connection.set(WORKER_HEARTBEAT_KEY, Date.now(), 'EX', WORKER_HEARTBEAT_EVERY_S * 10).catch(() => {});
beat();
const heartbeat = setInterval(beat, WORKER_HEARTBEAT_EVERY_S * 1000);

log.info('worker started');

const shutdown = async () => {
  clearInterval(heartbeat);
  await Promise.all(workers.map((w) => w.close()));
  await Promise.all([catalogQueue.close(), healthQueue.close(), reportsQueue.close()]);
  await pool.end();
  await connection.quit();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
