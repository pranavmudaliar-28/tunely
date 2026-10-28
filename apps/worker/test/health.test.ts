import { createDb, schema } from '@tunely/db';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { CheckResult } from '../src/health/check-stream';
import { runCatalogSync } from '../src/jobs/catalog-sync';
import { rescore, runHealthBatch } from '../src/jobs/health';
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

  const publicIds = async () =>
    (await db.select({ id: schema.publicChannels.id }).from(schema.publicChannels)).map((r) => r.id).sort();

  test('every stream gets a health row; only approved, healthy channels become public', async () => {
    const res = await runHealthBatch(db, { checker: async (s) => (s.url.includes('dw') ? bad : good) });
    expect(res).toMatchObject({ checked: 2, ok: 1, webPlayable: 1 });
    expect(await db.$count(schema.streamHealth)).toBe(await db.$count(schema.streams));

    expect(await publicIds()).toEqual([]); // still pending
    await db.update(schema.channelCuration).set({ status: 'approved' });
    expect(await publicIds()).toEqual(['DDNews.in']); // DW's only stream failed

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
    expect(await publicIds()).toEqual([]);

    await db.update(schema.streamHealth).set({ lastCheckedAt: sql`now() - interval '5 hours'` });
    await runHealthBatch(db, { checker: async () => good });
    expect(await publicIds()).toEqual(['DDNews.in', 'DWNews.de']);

    const [dd] = await db
      .select({ id: schema.streams.id })
      .from(schema.streams)
      .where(eq(schema.streams.channelId, 'DDNews.in'));
    await db
      .insert(schema.playbackReports)
      .values(
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
    expect(await publicIds()).toEqual(['DWNews.de']);
  });
});
