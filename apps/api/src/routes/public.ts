import { schema } from '@tunely/db';
import {
  ChannelListQuerySchema,
  ChannelListSchema,
  ChannelSchema,
  FacetListSchema,
  FacetsQuerySchema,
  FacetsSchema,
  PlaybackReportSchema,
  REPORTS_BUFFER,
  TrendingSchema,
  type ChannelSummary,
  type FacetsQuery,
} from '@tunely/shared';
import { and, arrayContains, asc, desc, eq, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Deps } from '../app';
import { cached, cacheKey } from '../cache';

const pc = schema.publicChannels;
const ErrorSchema = z.object({ error: z.string() });

/** Escaped `%term%` for ilike. */
const likePattern = (term: string) => `%${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

/**
 * The filters shared by the channel list and the browse counts, so the two always agree. `omit` leaves one out: each
 * facet is counted with every filter except its own, so viewers can see what switching would give.
 */
export function channelWhere(f: FacetsQuery, omit?: 'country' | 'category' | 'language' | 'status'): SQL[] {
  const where: SQL[] = [];
  if (f.country && omit !== 'country') where.push(eq(pc.countryCode, f.country));
  if (f.category && omit !== 'category') where.push(arrayContains(pc.categories, [f.category]));
  if (f.language && omit !== 'language') where.push(arrayContains(pc.languages, [f.language]));
  if (f.status && omit !== 'status') where.push(eq(pc.status, f.status));
  if (f.q) {
    const like = likePattern(f.q);
    where.push(
      sql`(${pc.name} ilike ${like} or ${pc.name} % ${f.q} or array_to_string(${pc.altNames}, ' ') ilike ${like} or coalesce(${pc.network}, '') ilike ${like})`,
    );
  }
  return where;
}

type Row = typeof pc.$inferSelect;
const toSummary = (r: Row): ChannelSummary => ({
  id: r.id,
  name: r.name,
  country: r.countryCode,
  categories: r.categories,
  languages: r.languages,
  logo: r.logoUrl,
  quality: r.bestQuality ?? (r.bestHeight ? `${r.bestHeight}p` : null),
  status: r.status,
});

// Cursor: keyset on (status rank, name, id) for browsing, so live channels come first; offset for
// search, which is ordered by relevance.
const Cursor = z.union([
  z.object({ r: z.number().int().min(0).max(9), n: z.string(), i: z.string() }),
  z.object({ o: z.number().int().min(0).max(10_000) }),
]);
const encodeCursor = (c: z.infer<typeof Cursor>) => Buffer.from(JSON.stringify(c)).toString('base64url');
function decodeCursor(raw: string | undefined) {
  if (!raw) return null;
  try {
    return Cursor.parse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
  } catch {
    return undefined;
  }
}

/** Daily-rotating salted hash: lets us de-duplicate viewers for a day without storing anything identifying. */
export function anonSessionHash(secret: string, sessionId: string, now = new Date()) {
  return createHash('sha256')
    .update(`${secret}:${now.toISOString().slice(0, 10)}:${sessionId}`)
    .digest('hex')
    .slice(0, 32);
}

export const publicRoutes =
  (deps: Deps): FastifyPluginAsyncZod =>
  async (app) => {
    const { db, redis } = deps;

    app.get(
      '/v1/channels',
      {
        schema: {
          tags: ['channels'],
          summary: 'Browse and search channels',
          querystring: ChannelListQuerySchema,
          response: { 200: ChannelListSchema, 400: ErrorSchema },
        },
      },
      async (req, reply) => {
        const q = req.query;
        const cursor = decodeCursor(q.cursor);
        if (cursor === undefined) return reply.code(400).send({ error: 'invalid cursor' });

        return cached(redis, cacheKey(req.url), reply, async () => {
          const where = channelWhere(q);
          if (q.ids) where.push(inArray(pc.id, q.ids.split(',').slice(0, 50)));

          if (q.q) {
            const term = q.q;
            const like = likePattern(term);
            const offset = cursor && 'o' in cursor ? cursor.o : 0;
            const rows = await db
              .select()
              .from(pc)
              .where(and(...where))
              .orderBy(
                // Names starting with the term first (even if dead: that's the channel they asked for),
                // then other real matches, then live before dead, then fuzzy similarity.
                desc(sql`(${pc.name} ilike ${term + '%'})`),
                // Real text matches (name, alt name, network) before trigram look-alikes.
                desc(
                  sql`(${pc.name} ilike ${like} or array_to_string(${pc.altNames}, ' ') ilike ${like} or coalesce(${pc.network}, '') ilike ${like})`,
                ),
                asc(pc.statusRank),
                desc(sql`similarity(${pc.name}, ${term})`),
                asc(pc.id),
              )
              .limit(q.limit + 1)
              .offset(offset);
            return {
              items: rows.slice(0, q.limit).map(toSummary),
              nextCursor: rows.length > q.limit ? encodeCursor({ o: offset + q.limit }) : null,
            };
          }

          if (q.sort === 'best') {
            // Offset paging: the order key (score, height) isn't unique enough for a keyset cursor.
            const offset = cursor && 'o' in cursor ? cursor.o : 0;
            const rows = await db
              .select()
              .from(pc)
              .where(and(...where))
              .orderBy(
                asc(pc.statusRank),
                sql`${pc.bestScore} desc nulls last`,
                sql`${pc.bestHeight} desc nulls last`,
                sql`(${pc.logoUrl} is null)`,
                asc(pc.sortName),
              )
              .limit(q.limit + 1)
              .offset(offset);
            return {
              items: rows.slice(0, q.limit).map(toSummary),
              nextCursor: rows.length > q.limit ? encodeCursor({ o: offset + q.limit }) : null,
            };
          }

          if (cursor && 'n' in cursor) {
            where.push(
              sql`(${pc.statusRank}, ${pc.sortName}, ${pc.id}) > (${cursor.r}, ${cursor.n}, ${cursor.i})`,
            );
          }
          const rows = await db
            .select()
            .from(pc)
            .where(and(...where))
            .orderBy(asc(pc.statusRank), asc(pc.sortName), asc(pc.id))
            .limit(q.limit + 1);
          const items = rows.slice(0, q.limit);
          const last = items.at(-1);
          return {
            items: items.map(toSummary),
            nextCursor:
              rows.length > q.limit && last
                ? encodeCursor({ r: last.statusRank, n: last.sortName, i: last.id })
                : null,
          };
        });
      },
    );

    const IdParams = z.object({ id: z.string().min(1).max(200) });

    app.get(
      '/v1/channels/:id',
      {
        schema: {
          tags: ['channels'],
          summary: 'Channel detail with streams ordered by score',
          params: IdParams,
          response: { 200: ChannelSchema, 404: ErrorSchema },
        },
      },
      async (req, reply) => {
        const result = await cached(redis, cacheKey(req.url), reply, async () => {
          const [row] = await db.select().from(pc).where(eq(pc.id, req.params.id));
          if (!row) return null;
          const streams = await db
            .select({
              id: schema.streams.id,
              url: schema.streams.url,
              quality: schema.streams.quality,
              height: schema.streamHealth.height,
              score: schema.streamHealth.score,
              webPlayable: schema.streamHealth.webPlayable,
              nativePlayable: schema.streamHealth.nativePlayable,
              referrer: schema.streams.referrer,
              userAgent: schema.streams.userAgent,
            })
            .from(schema.streams)
            // Every stream, not only verified ones: a viewer's browser may reach streams our server can't
            // (geo-limited), so clients may offer "Try to play". Verified (web-playable, score >= 50) first.
            .leftJoin(schema.streamHealth, eq(schema.streamHealth.streamId, schema.streams.id))
            .where(eq(schema.streams.channelId, row.id))
            .orderBy(
              sql`(${schema.streamHealth.webPlayable} and ${schema.streamHealth.score} >= 50) desc nulls last`,
              sql`${schema.streamHealth.score} desc nulls last`,
              sql`${schema.streamHealth.height} desc nulls last`,
            );
          return {
            ...toSummary(row),
            website: row.website,
            streams: streams.map(({ height, score, webPlayable, nativePlayable, ...s }) => ({
              ...s,
              score: score ?? 0,
              webPlayable: webPlayable ?? false,
              nativePlayable: nativePlayable ?? false,
              quality: s.quality ?? (height ? `${height}p` : null),
            })),
          };
        });
        if (!result) {
          reply.header('cache-control', 'public, max-age=60');
          return reply.code(404).send({ error: 'not found' });
        }
        return result;
      },
    );

    app.get(
      '/v1/channels/:id/related',
      {
        schema: {
          tags: ['channels'],
          summary: 'Channels from the same country or category',
          params: IdParams,
          querystring: z.object({ limit: z.coerce.number().int().min(1).max(48).default(12) }),
          response: { 200: ChannelListSchema, 404: ErrorSchema },
        },
      },
      async (req, reply) => {
        const result = await cached(redis, cacheKey(req.url), reply, async () => {
          const [row] = await db.select().from(pc).where(eq(pc.id, req.params.id));
          if (!row) return null;
          const sameCountry = eq(pc.countryCode, row.countryCode);
          const sameCategory = sql`${pc.categories} && ${sql.param(row.categories)}::text[]`;
          const rows = await db
            .select()
            .from(pc)
            // Live only: related channels double as the player's channel up/down list.
            .where(and(ne(pc.id, row.id), eq(pc.status, 'live'), or(sameCountry, sameCategory)))
            .orderBy(
              desc(sql`(${sameCountry} and ${sameCategory})`),
              desc(sameCountry),
              desc(pc.bestScore),
              asc(pc.name),
            )
            .limit(req.query.limit);
          return { items: rows.map(toSummary), nextCursor: null };
        });
        if (!result) return reply.code(404).send({ error: 'not found' });
        return result;
      },
    );

    app.get(
      '/v1/facets',
      {
        schema: {
          tags: ['facets'],
          summary: 'Channel counts per country, category, language and status for the current filters',
          querystring: FacetsQuerySchema,
          response: { 200: FacetsSchema },
        },
      },
      async (req, reply) =>
        cached(redis, cacheKey(req.url), reply, async () => {
          const f = req.query;
          const count = sql<number>`count(*)::int`;
          const unnested = (
            column: typeof pc.categories | typeof pc.languages,
            omit: 'category' | 'language',
          ) => {
            const sub = db
              .select({ id: sql<string>`unnest(${column})`.as('id') })
              .from(pc)
              .where(and(...channelWhere(f, omit)))
              .as('u');
            return db.select({ id: sub.id, count }).from(sub).groupBy(sub.id);
          };
          const [countries, categories, languages, statuses] = await Promise.all([
            db
              .select({ id: pc.countryCode, count })
              .from(pc)
              .where(and(...channelWhere(f, 'country')))
              .groupBy(pc.countryCode),
            unnested(pc.categories, 'category'),
            unnested(pc.languages, 'language'),
            db
              .select({ id: pc.status, count })
              .from(pc)
              .where(and(...channelWhere(f, 'status')))
              .groupBy(pc.status),
          ]);
          return { countries, categories, languages, statuses };
        }),
    );

    const facet = (path: string, summary: string, query: SQL) =>
      app.get(
        path,
        { schema: { tags: ['facets'], summary, response: { 200: FacetListSchema } } },
        async (req, reply) =>
          cached(redis, cacheKey(req.url), reply, async () => {
            const rows = await db.execute<{ id: string; name: string; count: number; flag?: string | null }>(
              query,
            );
            return { items: rows.rows.map((r) => ({ ...r, count: Number(r.count) })) };
          }),
      );

    facet(
      '/v1/countries',
      'Countries with channel counts',
      sql`select p.country_code as id, coalesce(c.name, p.country_code) as name, c.flag, count(*)::int as count
          from public_channels p left join countries c on c.code = p.country_code
          group by p.country_code, c.name, c.flag order by count desc, name`,
    );
    facet(
      '/v1/categories',
      'Categories with channel counts',
      sql`select cat as id, coalesce(c.name, cat) as name, count(*)::int as count
          from public_channels p, unnest(p.categories) cat left join categories c on c.id = cat
          group by cat, c.name order by count desc, name`,
    );
    facet(
      '/v1/languages',
      'Languages with channel counts',
      sql`select lang as id, coalesce(l.name, lang) as name, count(*)::int as count
          from public_channels p, unnest(p.languages) lang left join languages l on l.code = lang
          group by lang, l.name order by count desc, name`,
    );

    app.get(
      '/v1/trending',
      {
        schema: {
          tags: ['channels'],
          summary: 'Most watched in the last 24 h',
          response: { 200: TrendingSchema },
        },
      },
      async (req, reply) =>
        cached(redis, cacheKey(req.url), reply, async () => {
          const rows = await db.execute<Row & { viewers: number }>(sql`
            select p.id, p.name, p.country_code as "countryCode", p.categories, p.languages, p.logo_url as "logoUrl",
                   p.best_quality as "bestQuality", p.best_height as "bestHeight", p.status, count(distinct r.anon_session_hash)::int as viewers
            from playback_reports r
            join streams s on s.id = r.stream_id
            join public_channels p on p.id = s.channel_id
            where r.result = 'ok' and r.created_at > now() - interval '24 hours' and p.status = 'live'
            group by p.id, p.name, p.country_code, p.categories, p.languages, p.logo_url, p.best_quality, p.best_height, p.status
            order by viewers desc, p.name
            limit 24`);
          return { items: rows.rows.map((r) => ({ ...toSummary(r), viewers: Number(r.viewers) })) };
        }),
    );

    app.post(
      '/v1/playback-reports',
      {
        config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
        schema: {
          tags: ['reports'],
          summary: 'Report a playback attempt (feeds the health score)',
          body: PlaybackReportSchema,
          response: { 202: z.object({ accepted: z.literal(true) }) },
        },
      },
      async (req, reply) => {
        const { sessionId, ...report } = req.body;
        // Buffered in Redis; the worker batches these into Postgres.
        const entry = {
          ...report,
          anonSessionHash: anonSessionHash(deps.reportHashSecret, sessionId),
          at: new Date().toISOString(),
        };
        // Bounded so a stopped worker can't grow Redis without limit.
        await redis
          .multi()
          .rpush(REPORTS_BUFFER, JSON.stringify(entry))
          .ltrim(REPORTS_BUFFER, -100_000, -1)
          .exec();
        return reply.code(202).send({ accepted: true as const });
      },
    );
  };
