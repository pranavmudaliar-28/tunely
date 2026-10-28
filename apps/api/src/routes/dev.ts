import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Deps } from '../app';

// Development only: a random sample of web-playable streams for the /dev/stream-test page.
// Ignores curation on purpose, so it is never registered in production.
export const devRoutes =
  (deps: Deps): FastifyPluginAsyncZod =>
  async (app) => {
    app.get(
      '/v1/dev/web-playable-sample',
      {
        schema: {
          hide: true,
          querystring: z.object({ n: z.coerce.number().int().min(1).max(200).default(50) }),
        },
      },
      async (req) => {
        const rows = await deps.db.execute<{
          stream_id: string;
          channel_id: string;
          name: string;
          url: string;
          score: number;
        }>(sql`
          select s.id as stream_id, c.id as channel_id, c.name, s.url, h.score
          from streams s join stream_health h on h.stream_id = s.id join channels c on c.id = s.channel_id
          where h.web_playable and h.score >= 50
          order by random() limit ${req.query.n}`);
        return { items: rows.rows };
      },
    );
  };
