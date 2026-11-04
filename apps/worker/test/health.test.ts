import { createDb, refreshPublicChannels, schema } from '@tunely/db';
import { eq, sql, type SQL } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { config } from '../src/config';
import type { CheckResult } from '../src/health/check-stream';
import { runCatalogSync } from '../src/jobs/catalog-sync';
import { pruneHistory, rescore, runHealthBatch } from '../src/jobs/health';
import { fixtureCatalog } from './fixtures/catalog';

const good: CheckResult = {
  ok: true,
  httpStatus: 200,
  isHttps: true,
  hasCors: true,
  needsHeaders: false,
  latencyMs: 300,
  height: 720,
  errorCode: null,
};
const bad: CheckResult = {
  ...good,
  ok: false,
  httpStatus: 503,
  errorCode: 'http_503',
  latencyMs: null,
  height: null,
};

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('health jobs (database)', () => {
  const { db, pool } = createDb(url ?? '');
  const reset = () =>
    db.execute(
      sql`truncate channels, feeds, streams, logos, countries, categories, languages, blocklist, channel_curation, sync_runs, stream_health, stream_checks, playback_reports`,
    );
  beforeAll(async () => {
    await reset();
    await runCatalogSync(db, fixtureCatalog());
  });
  afterAll(async () => {
    await reset();
    await pool.end();
  });

  const liveIds = async () => {
    await refreshPublicChannels(db);
    return (
      await db
        .select({ id: schema.publicChannels.id })
        .from(schema.publicChannels)
        .where(eq(schema.publicChannels.status, 'live'))
    )
      .map((r) => r.id)
      .sort();
  };

  test('every stream gets a health row; only healthy channels are live; hidden ones vanish', async () => {
    const res = await runHealthBatch(db, { checker: async (s) => (s.url.includes('dw') ? bad : good) });
    expect(res).toMatchObject({ checked: 2, ok: 1, webPlayable: 1 });
    expect(await db.$count(schema.streamHealth)).toBe(await db.$count(schema.streams));

    expect(await liveIds()).toEqual(['DDNews.in']); // DW's only stream failed
    const listed = await db.select().from(schema.publicChannels);
    expect(listed.find((c) => c.id === 'DWNews.de')?.status).toBe('offline');

    await db
      .update(schema.channelCuration)
      .set({ status: 'hidden' })
      .where(eq(schema.channelCuration.channelId, 'DDNews.in'));
    expect(await liveIds()).toEqual([]);
    await db.update(schema.channelCuration).set({ status: 'approved' });
    await refreshPublicChannels(db);

    const [dd] = await db
      .select()
      .from(schema.publicChannels)
      .where(eq(schema.publicChannels.id, 'DDNews.in'));
    expect(dd).toMatchObject({
      bestScore: 100,
      bestHeight: 720,
      languages: ['hin'],
      logoUrl: 'https://example.com/dd.png',
    });
  });

  test('streams are not rechecked inside the 4 h window', async () => {
    expect((await runHealthBatch(db, { checker: async () => good })).checked).toBe(0);
  });

  test('a failing latest check hides the channel; bad player reports lower the score', async () => {
    await db.update(schema.streamHealth).set({ lastCheckedAt: sql`now() - interval '5 hours'` });
    await runHealthBatch(db, { checker: async () => bad });
    expect(await liveIds()).toEqual([]);

    await db.update(schema.streamHealth).set({ lastCheckedAt: sql`now() - interval '5 hours'` });
    await runHealthBatch(db, { checker: async () => good });
    expect(await liveIds()).toEqual(['DDNews.in', 'DWNews.de']);

    const [dd] = await db
      .select({ id: schema.streams.id })
      .from(schema.streams)
      .where(eq(schema.streams.channelId, 'DDNews.in'));
    // Devices that can't decode the codec say nothing about the stream: no effect on the score.
    await db.insert(schema.playbackReports).values(
      Array.from({ length: 10 }, () => ({
        streamId: dd!.id,
        platform: 'web',
        result: 'error' as const,
        errorType: 'unsupported_codec',
        anonSessionHash: 'y',
      })),
    );
    await rescore(db);
    expect(await liveIds()).toEqual(['DDNews.in', 'DWNews.de']);
    await db.execute(sql`truncate playback_reports`);

    await db.insert(schema.playbackReports).values(
      Array.from({ length: 10 }, () => ({
        streamId: dd!.id,
        platform: 'web',
        result: 'error' as const,
        anonSessionHash: 'x',
      })),
    );
    await rescore(db);
    const [h] = await db.select().from(schema.streamHealth).where(eq(schema.streamHealth.streamId, dd!.id));
    expect(h!.score).toBeLessThan(50);
    expect(await liveIds()).toEqual(['DWNews.de']);
  });

  test('a stream our server cannot reach goes live once two viewer sessions play it', async () => {
    await db.update(schema.streamHealth).set({ lastCheckedAt: sql`now() - interval '5 hours'` });
    await runHealthBatch(db, { checker: async () => ({ ...bad, isHttps: false, hasCors: false }) });
    await db.update(schema.streamHealth).set({ webPlayable: false });
    await db.execute(sql`truncate playback_reports`);
    expect(await liveIds()).toEqual([]);

    const [dw] = await db
      .select({ id: schema.streams.id })
      .from(schema.streams)
      .where(eq(schema.streams.channelId, 'DWNews.de'));
    const play = (session: string) => ({
      streamId: dw!.id,
      platform: 'web',
      result: 'ok' as const,
      anonSessionHash: session,
    });
    await db.insert(schema.playbackReports).values([play('a')]);
    expect((await rescore(db, [dw!.id])).changed).toBe(0); // one viewer isn't enough
    await db.insert(schema.playbackReports).values([play('b')]);
    expect((await rescore(db, [dw!.id])).changed).toBe(1);
    expect(await liveIds()).toEqual(['DWNews.de']);
    // A score that moves but stays live changes nothing public_channels shows: no refresh needed.
    const health = eq(schema.streamHealth.streamId, dw!.id);
    await db.update(schema.streamHealth).set({ score: 70 }).where(health);
    expect((await rescore(db, [dw!.id])).changed).toBe(0);
    const [h] = await db.select().from(schema.streamHealth).where(health);
    expect(h!.score).toBe(60);
  });

  test('pruneHistory drops only old check partitions and old reports', async () => {
    const partitions = async () =>
      (
        await db.execute<{ name: string }>(
          sql`select relname as name from pg_class where relname ~ '^stream_checks_[0-9]{6}$' order by 1`,
        )
      ).rows.map((r) => r.name);
    // The month holding the retention cutoff still has rows to keep; the one two months before it doesn't.
    const cutoff = sql`now() - make_interval(days => ${config.checksRetentionDays + 1})`;
    const name = (ts: SQL) => sql`to_char(${ts}, '"stream_checks_"YYYYMM')`;
    const [p] = (
      await db.execute<{ edge: string; old: string }>(
        sql`select ${name(cutoff)} as edge, ${name(sql`${cutoff} - interval '2 months'`)} as old`,
      )
    ).rows;
    await db.execute(sql`truncate stream_checks, playback_reports`);
    await db.execute(
      sql`select ensure_stream_checks_partition(${cutoff}), ensure_stream_checks_partition(${cutoff} - interval '2 months')`,
    );
    expect(await partitions()).toEqual(expect.arrayContaining([p!.edge, p!.old]));

    const [dd] = await db.select({ id: schema.streams.id }).from(schema.streams).limit(1);
    const report = { streamId: dd!.id, platform: 'web', result: 'ok' as const, anonSessionHash: 'p' };
    await db
      .insert(schema.playbackReports)
      .values([report, { ...report, createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000) }]);

    await pruneHistory(db);
    const left = await partitions();
    expect(left).not.toContain(p!.old);
    expect(left).toContain(p!.edge);
    expect(await db.$count(schema.playbackReports)).toBe(1);
  });
});
