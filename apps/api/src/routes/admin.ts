import { refreshPublicChannels, schema } from '@tunely/db';
import { JOB } from '@tunely/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAdmin } from '../admin-auth';
import type { Deps } from '../app';
import { clearCache } from '../cache';

const CurateBody = z.object({
  ids: z.array(z.string().trim().min(1).max(200)).min(1).max(500),
  status: z.enum(schema.curationStatus),
  reason: z.string().trim().max(500).optional(),
});

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

    // Takedowns from production. The curate CLI can't do this part: Render's Redis only accepts Render services, so
    // only the API can clear the cached responses that would keep a hidden channel (and its streams) up for 5 minutes.
    app.post(
      '/v1/admin/curate',
      {
        schema: {
          hide: true,
          body: CurateBody,
          response: { 200: z.object({ updated: z.number().int(), cacheCleared: z.boolean() }) },
        },
      },
      async (req) => {
        const { status, reason = null } = req.body;
        const ids = [...new Set(req.body.ids)];
        const decision = { status, reason, reviewedBy: 'admin-api', reviewedAt: new Date() };
        // Upsert: a takedown for a channel that isn't synced yet still holds when it arrives.
        const rows = await deps.db
          .insert(schema.channelCuration)
          .values(ids.map((channelId) => ({ channelId, ...decision })))
          .onConflictDoUpdate({ target: schema.channelCuration.channelId, set: decision })
          .returning({ id: schema.channelCuration.channelId });
        await refreshPublicChannels(deps.db);
        const cacheCleared = await clearCache(deps.redis);
        // The request log is the audit trail: who acted is the token, what changed is here.
        req.log.info({ ids, status, reason, cacheCleared }, 'curation changed');
        return { updated: rows.length, cacheCleared };
      },
    );
  };
