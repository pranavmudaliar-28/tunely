import { WORKER_HEARTBEAT_EVERY_S, WORKER_HEARTBEAT_KEY, WORKER_JOBS_KEY } from '@tunely/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Deps } from '../app';

const startedAt = Date.now();

const DetailsSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  uptimeSeconds: z.number().int(),
  redis: z.enum(['ok', 'down']),
  worker: z.object({
    status: z.enum(['ok', 'stale', 'unknown']),
    lastSeenSecondsAgo: z.number().int().nullable(),
    /** Last run of each background job: when, how long, its counts or its error. */
    jobs: z.record(z.string(), z.unknown()),
  }),
});

/**
 * GET /v1/health/details: for monitors that should alert when something is wrong. Checks Redis and
 * the worker's heartbeat; never queries Postgres, so pinging it doesn't wake a sleeping free database.
 * 503 when degraded. (GET /v1/health stays dependency-free for keep-awake pings.)
 */
export const healthRoutes =
  (deps: Deps): FastifyPluginAsyncZod =>
  async (app) => {
    app.get(
      '/v1/health/details',
      { schema: { tags: ['meta'], response: { 200: DetailsSchema, 503: DetailsSchema } } },
      async (_req, reply) => {
        let redis: 'ok' | 'down' = 'ok';
        let beat: string | null = null;
        let jobs: Record<string, unknown> = {};
        try {
          beat = await deps.redis.get(WORKER_HEARTBEAT_KEY);
          jobs = Object.fromEntries(
            Object.entries(await deps.redis.hgetall(WORKER_JOBS_KEY)).map(([k, v]) => {
              try {
                return [k, JSON.parse(v) as unknown];
              } catch {
                return [k, v];
              }
            }),
          );
        } catch {
          redis = 'down';
        }
        const ago = beat ? Math.round((Date.now() - Number(beat)) / 1000) : null;
        // Missing three beats in a row means the worker is stuck or gone.
        const worker: 'ok' | 'stale' | 'unknown' =
          ago === null ? 'unknown' : ago <= WORKER_HEARTBEAT_EVERY_S * 3 ? 'ok' : 'stale';
        const body = {
          status: redis === 'ok' && worker === 'ok' ? ('ok' as const) : ('degraded' as const),
          uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
          redis,
          worker: { status: worker, lastSeenSecondsAgo: ago, jobs },
        };
        reply.header('cache-control', 'no-store');
        return reply.code(body.status === 'ok' ? 200 : 503).send(body);
      },
    );
  };
