import { createDb, schema } from '@tunely/db';
import { REPORTS_BUFFER } from '@tunely/shared';
import { sql } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { runCatalogSync } from '../src/jobs/catalog-sync';
import { flushReports } from '../src/jobs/reports';
import { fixtureCatalog } from './fixtures/catalog';

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('flushReports', () => {
  const { db, pool } = createDb(url ?? '');
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { db: 14 });
  beforeAll(async () => {
    await db.execute(sql`truncate channels, streams, playback_reports, channel_curation`);
    await runCatalogSync(db, fixtureCatalog());
    await redis.del(REPORTS_BUFFER);
  });
  afterAll(async () => {
    await redis.quit();
    await pool.end();
  });

  test('moves valid reports for known streams into Postgres and empties the buffer', async () => {
    const [stream] = await db.select({ id: schema.streams.id }).from(schema.streams).limit(1);
    const ok = {
      streamId: stream!.id,
      platform: 'web',
      result: 'ok',
      errorType: null,
      ttffMs: 900,
      anonSessionHash: 'h1',
      at: new Date().toISOString(),
    };
    await redis.rpush(
      REPORTS_BUFFER,
      JSON.stringify(ok),
      JSON.stringify({ ...ok, result: 'error', errorType: 'offline', anonSessionHash: 'h2' }),
      JSON.stringify({ ...ok, streamId: '00000000-0000-4000-8000-0000000000ff' }), // unknown stream
      'not json',
    );
    expect(await flushReports(db, redis)).toBe(2);
    expect(await redis.llen(REPORTS_BUFFER)).toBe(0);
    const rows = await db.select().from(schema.playbackReports);
    expect(rows.map((r) => [r.result, r.errorType, r.ttffMs]).sort()).toEqual([
      ['error', 'offline', 900],
      ['ok', null, 900],
    ]);
  });
});
