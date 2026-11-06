import { gunzipSync } from 'node:zlib';
import type { Db } from '@tunely/db';
import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { parseProgrammes, pickFiles, splitSiteId, type Programme } from '../guide/xmltv';
import { safeFetch } from '../net/safe-fetch';

/**
 * Programme guide (Now & Next) from i.mjh.nz, which publishes ready XMLTV files (no scraping). The owner chose this
 * source on 6 Nov 2026; sites that need iptv-org's grabber are not used.
 */
export const GUIDE_SITE = 'i.mjh.nz';
const GUIDES_JSON = 'https://iptv-org.github.io/api/guides.json';
/** Set while the listing map is fresh: guides.json is ~25 MB, so it's read once a day, not every run. */
const SOURCES_FRESH_KEY = 'tunely:guide:sources-fresh';
const MAX_FILES = 30;
const WINDOW_H = 36;
const MAX_GUIDES_JSON = 60 * 1024 * 1024;
const MAX_GZ = 25 * 1024 * 1024;
/** Gzip bomb guard: the largest file is ~14 MB unpacked. */
const MAX_XML = 150 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 90_000;

const GuideRow = z.object({
  channel: z.string().min(1).max(100),
  site: z.literal(GUIDE_SITE),
  site_id: z.string().min(3).max(300),
});

/** Refresh which i.mjh.nz listing each channel has, at most once a day. Keeps the old map if upstream looks broken. */
export async function refreshGuideSources(db: Db, redis: Redis): Promise<number | null> {
  if (await redis.get(SOURCES_FRESH_KEY)) return null;
  const res = await safeFetch(GUIDES_JSON, {
    maxBytes: MAX_GUIDES_JSON,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (res.status !== 200) throw new Error(`guides.json: HTTP ${res.status}`);
  // Drop other sites while parsing, so 180k objects never sit in memory at once.
  const parsed: unknown = JSON.parse(res.body.toString('utf8'), (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v) && 'site' in v && v.site !== GUIDE_SITE ? undefined : v,
  );
  const rows = (Array.isArray(parsed) ? parsed : [])
    .map((r) => GuideRow.safeParse(r))
    .flatMap((r) => (r.success && splitSiteId(r.data.site_id) ? [r.data] : []));
  if (rows.length < 100)
    throw new Error(`guides.json: only ${rows.length} ${GUIDE_SITE} listings, keeping the old map`);
  await db.transaction(async (tx) => {
    await tx.execute(sql`delete from guide_sources where site = ${GUIDE_SITE}`);
    for (let i = 0; i < rows.length; i += 2000) {
      await tx.execute(sql`
        insert into guide_sources (channel_id, site, site_id)
        select v.channel, v.site, v.site_id from jsonb_to_recordset(${JSON.stringify(rows.slice(i, i + 2000))}::jsonb)
          as v(channel text, site text, site_id text)
        on conflict do nothing`);
    }
  });
  await redis.set(SOURCES_FRESH_KEY, new Date().toISOString(), 'EX', 23 * 3600);
  return rows.length;
}

/** Replace the programmes of `channelIds` with `rows`, and drop everything that has ended. */
export async function writeProgrammes(db: Db, channelIds: string[], rows: Programme[]) {
  await db.transaction(async (tx) => {
    if (channelIds.length) {
      await tx.execute(
        sql`delete from programmes where channel_id in (select jsonb_array_elements_text(${JSON.stringify(channelIds)}::jsonb))`,
      );
    }
    for (let i = 0; i < rows.length; i += 2000) {
      await tx.execute(sql`
        insert into programmes (channel_id, start, stop, title, description)
        select v."channelId", v.start, v.stop, v.title, v.description
        from jsonb_to_recordset(${JSON.stringify(rows.slice(i, i + 2000))}::jsonb)
          as v("channelId" text, start timestamptz, stop timestamptz, title text, description text)
        on conflict do nothing`);
    }
    await tx.execute(sql`delete from programmes where stop < now() - interval '1 hour'`);
  });
}

/** Fetch the guide files live channels need and store their next 36 hours. Runs every 6 hours. */
export async function runGuide(db: Db, redis: Redis, now = new Date()) {
  const sources = await refreshGuideSources(db, redis);
  const { rows } = await db.execute<{ channel_id: string; site_id: string }>(sql`
    select g.channel_id, g.site_id from guide_sources g
    join public_channels p on p.id = g.channel_id
    where g.site = ${GUIDE_SITE} and p.status = 'live'`);
  const listings = rows.flatMap((r) => {
    const s = splitSiteId(r.site_id);
    return s ? [{ channelId: r.channel_id, ...s }] : [];
  });
  const from = new Date(now.getTime() - 3600_000);
  const to = new Date(now.getTime() + WINDOW_H * 3600_000);

  // Each channel's schedule comes from the first file that has any programmes for it.
  const got = new Map<string, Programme[]>();
  const failed: string[] = [];
  const tried = new Set<string>();
  let todo = listings;
  // Second pass: channels with no schedule yet (file gone upstream, slow, or a stale listing) from other files.
  for (let pass = 0; pass < 2 && todo.length && tried.size < MAX_FILES; pass++) {
    for (const { file, wanted } of pickFiles(todo, MAX_FILES - tried.size)) {
      tried.add(file);
      try {
        const res = await safeFetch(`https://${GUIDE_SITE}/${file}.xml.gz`, {
          maxBytes: MAX_GZ,
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
        const xml = gunzipSync(res.body, { maxOutputLength: MAX_XML }).toString('utf8');
        const fresh = new Map<string, Programme[]>();
        for (const p of parseProgrammes(xml, wanted, from, to)) {
          if (got.has(p.channelId)) continue;
          fresh.set(p.channelId, [...(fresh.get(p.channelId) ?? []), p]);
        }
        for (const [id, list] of fresh) got.set(id, list);
      } catch (err) {
        failed.push(`${file}: ${String(err).slice(0, 120)}`);
      }
    }
    todo = listings.filter((l) => !got.has(l.channelId) && !tried.has(l.file));
  }
  // Channels with nothing new keep what they had until it ends; the next run tries again.
  const programmes = [...got.values()].flat();
  await writeProgrammes(db, [...got.keys()], programmes);
  return { sources, files: tried.size, channels: got.size, programmes: programmes.length, failed };
}
