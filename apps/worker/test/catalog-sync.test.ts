import { createDb, schema } from '@tunely/db';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { prepareCatalog, runCatalogSync } from '../src/jobs/catalog-sync';
import { fixtureCatalog } from './fixtures/catalog';

describe('prepareCatalog', () => {
  const c = prepareCatalog(fixtureCatalog());

  test('drops blocklisted and nsfw channels and their streams/feeds', () => {
    expect(c.channels.map((x) => x.id).sort()).toEqual(['DDNews.in', 'DWNews.de']);
    expect(c.feeds.map((f) => f.channel)).toEqual(['DDNews.in']);
    expect(c.streams.every((s) => s.channel !== 'Blocked.de')).toBe(true);
    expect(c.counts).toMatchObject({ dropped_blocked: 1, dropped_nsfw: 1, invalid_channels: 1 });
  });

  test('rejects non-http and private-host stream urls and channel-less streams', () => {
    expect(c.streams.map((s) => s.url).sort()).toEqual([
      'https://example.com/dd.m3u8',
      'https://example.com/dw.m3u8',
    ]);
    expect(c.counts.invalid_streams).toBe(3);
  });
});

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('runCatalogSync (database)', () => {
  const { db, pool } = createDb(url ?? '');
  const reset = () =>
    db.execute(
      sql`truncate channels, feeds, streams, logos, countries, categories, languages, blocklist, channel_curation, sync_runs, stream_health`,
    );
  beforeAll(reset);
  afterAll(async () => {
    await reset();
    await pool.end();
  });

  test('imports, sets new channels to pending, and is idempotent', async () => {
    const first = await runCatalogSync(db, fixtureCatalog());
    expect(first.new_channels).toBe(2);
    const curation = await db.select().from(schema.channelCuration);
    expect(curation.every((r) => r.status === 'pending')).toBe(true);

    // A curation decision survives later syncs.
    await db
      .update(schema.channelCuration)
      .set({ status: 'approved' })
      .where(eq(schema.channelCuration.channelId, 'DDNews.in'));
    const before = await db.select().from(schema.streams).orderBy(schema.streams.url);
    const second = await runCatalogSync(db, fixtureCatalog());
    const after = await db.select().from(schema.streams).orderBy(schema.streams.url);
    expect(second.new_channels).toBe(0);
    expect(after).toEqual(before);
    const [dd] = await db
      .select()
      .from(schema.channelCuration)
      .where(eq(schema.channelCuration.channelId, 'DDNews.in'));
    expect(dd?.status).toBe('approved');

    const runs = await db.select().from(schema.syncRuns);
    expect(runs.map((r) => r.status)).toEqual(['ok', 'ok']);
  });

  test('a channel that becomes blocklisted disappears with its streams', async () => {
    const raw = fixtureCatalog();
    (raw.blocklist as unknown[]).push({ channel: 'DWNews.de', reason: 'dmca', ref: null });
    const counts = await runCatalogSync(db, raw);
    expect(counts.removed_channels).toBe(1);
    const streams = await db.select().from(schema.streams);
    expect(streams.map((s) => s.channelId)).toEqual(['DDNews.in']);
  });
});
