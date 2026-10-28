import { schema, type Db } from '@tunely/db';
import {
  IPTV_FILES,
  parseRows,
  type IptvBlocklist,
  type IptvCategory,
  type IptvChannel,
  type IptvCountry,
  type IptvFeed,
  type IptvFileName,
  type IptvLanguage,
  type IptvLogo,
  type IptvStream,
} from '@tunely/shared';
import { and, eq, getTableColumns, sql, type SQL } from 'drizzle-orm';
import type { IndexColumn, PgColumn, PgTable, PgUpdateSetSource } from 'drizzle-orm/pg-core';

export const IPTV_API_BASE = 'https://iptv-org.github.io/api';

export type RawCatalog = Record<IptvFileName, unknown>;

export interface PreparedCatalog {
  channels: IptvChannel[];
  feeds: IptvFeed[];
  streams: IptvStream[];
  logos: IptvLogo[];
  categories: IptvCategory[];
  countries: IptvCountry[];
  languages: IptvLanguage[];
  blocklist: IptvBlocklist[];
  counts: Record<string, number>;
}

export async function downloadCatalog(
  base = IPTV_API_BASE,
  fetchFn: typeof fetch = fetch,
): Promise<RawCatalog> {
  const names = Object.keys(IPTV_FILES) as IptvFileName[];
  const bodies = await Promise.all(
    names.map(async (name) => {
      const res = await fetchFn(`${base}/${name}.json`, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw new Error(`iptv-org ${name}.json: HTTP ${res.status}`);
      return res.json() as Promise<unknown>;
    }),
  );
  return Object.fromEntries(names.map((n, i) => [n, bodies[i]])) as RawCatalog;
}

/** Validate every file and drop blocklisted / NSFW channels and everything hanging off them. Pure. */
export function prepareCatalog(raw: RawCatalog): PreparedCatalog {
  const counts: Record<string, number> = {};
  const parse = <N extends IptvFileName>(name: N) => {
    const { valid, invalid } = parseRows(IPTV_FILES[name], raw[name]);
    counts[`invalid_${name}`] = invalid;
    return valid;
  };

  const blocklist = parse('blocklist') as IptvBlocklist[];
  const blocked = new Set(blocklist.map((b) => b.channel));
  const allChannels = parse('channels') as IptvChannel[];
  const channels = allChannels.filter((c) => !blocked.has(c.id) && !c.is_nsfw);
  counts.dropped_blocked = allChannels.filter((c) => blocked.has(c.id)).length;
  counts.dropped_nsfw = allChannels.filter((c) => c.is_nsfw && !blocked.has(c.id)).length;

  const kept = new Set(channels.map((c) => c.id));
  const keep = <T extends { channel: string }>(rows: T[]) => rows.filter((r) => kept.has(r.channel));

  const feeds = uniqueBy(keep(parse('feeds') as IptvFeed[]), (f) => `${f.channel}\u0000${f.id}`);
  const streams = uniqueBy(keep(parse('streams') as IptvStream[]), (s) => s.url);
  const logos = uniqueBy(
    keep(parse('logos') as IptvLogo[]),
    (l) => `${l.channel}\u0000${l.feed ?? ''}\u0000${l.url}`,
  );

  const prepared = {
    channels,
    feeds,
    streams,
    logos,
    categories: parse('categories') as IptvCategory[],
    countries: parse('countries') as IptvCountry[],
    languages: parse('languages') as IptvLanguage[],
    blocklist,
    counts,
  };
  for (const k of [
    'channels',
    'feeds',
    'streams',
    'logos',
    'categories',
    'countries',
    'languages',
    'blocklist',
  ] as const) {
    counts[k] = prepared[k].length;
  }
  return prepared;
}

function uniqueBy<T>(rows: T[], key: (r: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const r of rows) if (!seen.has(key(r))) seen.set(key(r), r);
  return [...seen.values()];
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Upsert in chunks; only rows whose values actually differ are rewritten, so a re-run is a no-op. */
async function upsert<T extends PgTable>(
  tx: Tx,
  table: T,
  rows: T['$inferInsert'][],
  target: IndexColumn | IndexColumn[],
  updateCols: string[],
) {
  const cols = getTableColumns(table) as Record<string, { name: string }>;
  const set = Object.fromEntries(
    updateCols.map((c) => [c, sql.raw(`excluded."${cols[c]!.name}"`)]),
  ) as PgUpdateSetSource<T>;
  const changed = sql.join(
    updateCols.map(
      (c) =>
        sql`${table}.${sql.identifier(cols[c]!.name)} is distinct from excluded.${sql.identifier(cols[c]!.name)}`,
    ),
    sql` or `,
  );
  for (let i = 0; i < rows.length; i += 1000) {
    const chunk = rows.slice(i, i + 1000);
    if (updateCols.length === 0) await tx.insert(table).values(chunk).onConflictDoNothing();
    else await tx.insert(table).values(chunk).onConflictDoUpdate({ target, set, setWhere: changed });
  }
}

export async function writeCatalog(db: Db, c: PreparedCatalog): Promise<Record<string, number>> {
  const counts = { ...c.counts };
  await db.transaction(async (tx) => {
    const existing = new Set(
      (await tx.select({ id: schema.channels.id }).from(schema.channels)).map((r) => r.id),
    );
    counts.new_channels = c.channels.filter((ch) => !existing.has(ch.id)).length;

    await upsert(
      tx,
      schema.categories,
      c.categories.map((r) => ({ id: r.id, name: r.name, description: r.description })),
      schema.categories.id,
      ['name', 'description'],
    );
    await upsert(
      tx,
      schema.countries,
      c.countries.map((r) => ({ code: r.code, name: r.name, flag: r.flag, languages: r.languages })),
      schema.countries.code,
      ['name', 'flag', 'languages'],
    );
    await upsert(
      tx,
      schema.languages,
      c.languages.map((r) => ({ code: r.code, name: r.name })),
      schema.languages.code,
      ['name'],
    );

    await tx.delete(schema.blocklist);
    await upsert(
      tx,
      schema.blocklist,
      c.blocklist.map((r) => ({ channelId: r.channel, reason: r.reason, ref: r.ref })),
      schema.blocklist.channelId,
      [],
    );

    await upsert(
      tx,
      schema.channels,
      c.channels.map((r) => ({
        id: r.id,
        name: r.name,
        altNames: r.alt_names,
        network: r.network,
        countryCode: r.country.toUpperCase(),
        categories: r.categories,
        isNsfw: r.is_nsfw,
        website: r.website,
        launched: r.launched,
        closed: r.closed,
        replacedBy: r.replaced_by,
      })),
      schema.channels.id,
      [
        'name',
        'altNames',
        'network',
        'countryCode',
        'categories',
        'isNsfw',
        'website',
        'launched',
        'closed',
        'replacedBy',
      ],
    );

    // Channels gone from iptv-org, newly blocked or newly NSFW disappear with everything attached.
    const keptIds = c.channels.map((ch) => ch.id);
    counts.removed_channels = await deleteMissing(
      tx,
      schema.channels,
      sql`true`,
      schema.channels.id,
      keptIds,
    );

    await upsert(
      tx,
      schema.feeds,
      c.feeds.map((r) => ({
        channelId: r.channel,
        feedId: r.id,
        name: r.name,
        isMain: r.is_main,
        broadcastArea: r.broadcast_area,
        timezones: r.timezones,
        languages: r.languages,
        format: r.format,
      })),
      [schema.feeds.channelId, schema.feeds.feedId],
      ['name', 'isMain', 'broadcastArea', 'timezones', 'languages', 'format'],
    );

    await upsert(
      tx,
      schema.streams,
      c.streams.map((r) => ({
        channelId: r.channel,
        feedId: r.feed,
        title: r.title,
        url: r.url,
        referrer: r.referrer,
        userAgent: r.user_agent,
        quality: r.quality,
        labels: r.labels ?? (r.label ? [r.label] : []),
        source: 'iptv-org' as const,
      })),
      schema.streams.url,
      ['channelId', 'feedId', 'title', 'referrer', 'userAgent', 'quality', 'labels'],
    );

    await upsert(
      tx,
      schema.logos,
      c.logos.map((r) => ({
        channelId: r.channel,
        feedId: r.feed ?? '',
        url: r.url,
        width: r.width ?? null,
        height: r.height ?? null,
        format: r.format,
        inUse: r.in_use,
      })),
      [schema.logos.channelId, schema.logos.feedId, schema.logos.url],
      ['width', 'height', 'format', 'inUse'],
    );

    // Drop rows that no longer exist upstream (manual streams are ours and stay unless their channel went).
    await tx.execute(
      sql`delete from feeds f where not exists (select 1 from channels c where c.id = f.channel_id)`,
    );
    await tx.execute(
      sql`delete from logos l where not exists (select 1 from channels c where c.id = l.channel_id)`,
    );
    const streamUrls = c.streams.map((s) => s.url);
    await deleteMissing(
      tx,
      schema.streams,
      eq(schema.streams.source, 'iptv-org'),
      schema.streams.url,
      streamUrls,
    );
    await tx.execute(
      sql`delete from streams s where not exists (select 1 from channels c where c.id = s.channel_id)`,
    );
    await tx.execute(
      sql`delete from stream_health h where not exists (select 1 from streams s where s.id = h.stream_id)`,
    );

    // New channels wait for review. Existing curation decisions are never overwritten.
    await upsert(
      tx,
      schema.channelCuration,
      keptIds.map((id) => ({ channelId: id, status: 'pending' as const })),
      schema.channelCuration.channelId,
      [],
    );
    await tx.execute(
      sql`delete from channel_curation k where not exists (select 1 from channels c where c.id = k.channel_id)`,
    );
  });
  return counts;
}

async function deleteMissing(
  tx: Tx,
  table: PgTable,
  scope: SQL,
  col: PgColumn,
  keep: string[],
): Promise<number> {
  // Stage keys in a temp table: NOT IN with tens of thousands of literals is slow and hits param limits.
  await tx.execute(sql`create temp table if not exists _keep (k text primary key) on commit drop`);
  await tx.execute(sql`truncate _keep`);
  for (let i = 0; i < keep.length; i += 5000) {
    const chunk = keep.slice(i, i + 5000);
    await tx.execute(
      sql`insert into _keep (k) select jsonb_array_elements_text(${JSON.stringify(chunk)}::jsonb) on conflict do nothing`,
    );
  }
  const res = await tx
    .delete(table)
    .where(and(scope, sql`not exists (select 1 from _keep where _keep.k = ${col})`));
  return res.rowCount ?? 0;
}

export async function runCatalogSync(db: Db, raw?: RawCatalog): Promise<Record<string, number>> {
  const [run] = await db.insert(schema.syncRuns).values({}).returning({ id: schema.syncRuns.id });
  try {
    const counts = await writeCatalog(db, prepareCatalog(raw ?? (await downloadCatalog())));
    await db
      .update(schema.syncRuns)
      .set({ status: 'ok', finishedAt: new Date(), counts })
      .where(eq(schema.syncRuns.id, run!.id));
    return counts;
  } catch (err) {
    await db
      .update(schema.syncRuns)
      .set({ status: 'failed', finishedAt: new Date(), error: String(err).slice(0, 2000) })
      .where(eq(schema.syncRuns.id, run!.id));
    throw err;
  }
}
