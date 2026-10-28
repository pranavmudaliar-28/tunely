import { JOB } from '@tunely/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAdmin } from '../admin-auth';
import type { Deps } from '../app';

export const adminRoutes =
  (deps: Deps): FastifyPluginAsyncZod =>
  async (app) => {
    app.addHook('onRequest', requireAdmin(deps.adminToken));

    app.post(
      '/v1/admin/sync',
      { schema: { hide: true, response: { 202: z.object({ jobId: z.string() }) } } },
      async (req, reply) => {
        const job = await deps.queues.catalog.add(
          JOB.catalogSync,
          {},
          { removeOnComplete: 50, removeOnFail: 50 },
        );
        req.log.info({ jobId: job.id }, 'catalog sync enqueued');
        return reply.code(202).send({ jobId: String(job.id) });
      },
    );
  };
