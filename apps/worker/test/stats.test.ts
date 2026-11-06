import { createDb, schema } from '@tunely/db';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { previousDay, returningShare, rollupDailyStats } from '../src/jobs/stats';

test('previousDay is the UTC day before, across month and year ends', () => {
  expect(previousDay(new Date('2026-11-06T00:05:00Z'))).toBe('2026-11-05');
  expect(previousDay(new Date('2026-03-01T12:00:00Z'))).toBe('2026-02-28');
  expect(previousDay(new Date('2027-01-01T00:00:00Z'))).toBe('2026-12-31');
});

test('returningShare ignores unknown ages', () => {
  expect(returningShare({ first_day: 1, week: 2, month: 1, older: 0, unknown: 50 })).toBe(0.75);
  expect(returningShare({ unknown: 3 })).toBeNull();
  expect(returningShare({})).toBeNull();
});

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('rollupDailyStats', () => {
  const { db, pool } = createDb(url ?? '');
  const stream = '00000000-0000-4000-8000-0000000000aa';
  const now = new Date('2026-11-06T05:00:00Z');
  const report = (at: string, platform: string, s: string, result: 'ok' | 'error', extra: object = {}) => ({
    streamId: stream,
    platform,
    result,
    anonSessionHash: s,
    createdAt: new Date(at),
    ...extra,
  });

  beforeAll(async () => {
    await db.execute(sql`truncate playback_reports, daily_stats`);
    await db.insert(schema.playbackReports).values([
      report('2026-11-05T00:00:00Z', 'web', 's1', 'ok', { ttffMs: 1000, visitorAge: 'first_day' }),
      report('2026-11-05T10:00:00Z', 'web', 's1', 'ok', { ttffMs: 3000, visitorAge: 'first_day' }),
      report('2026-11-05T23:59:59Z', 'web', 's2', 'error', { errorType: 'offline', visitorAge: 'week' }),
      report('2026-11-05T12:00:00Z', 'android', 's3', 'ok', { ttffMs: 500 }),
      // Outside the day: today and the day before.
      report('2026-11-06T00:00:00Z', 'web', 's4', 'ok', { ttffMs: 9000 }),
      report('2026-11-04T23:59:59Z', 'web', 's5', 'error', { errorType: 'timeout' }),
    ]);
  });
  afterAll(async () => {
    await pool.end();
  });

  test('writes one row per platform for yesterday, once', async () => {
    expect(await rollupDailyStats(db, now)).toBe(true);
    const rows = await db.select().from(schema.dailyStats).orderBy(schema.dailyStats.platform);
    expect(rows).toEqual([
      {
        day: '2026-11-05',
        platform: 'android',
        sessions: 1,
        attempts: 1,
        ok: 1,
        errors: {},
        visitors: { unknown: 1 },
        ttffP50: 500,
        ttffP90: 500,
      },
      {
        day: '2026-11-05',
        platform: 'web',
        sessions: 2,
        attempts: 3,
        ok: 2,
        errors: { offline: 1 },
        visitors: { first_day: 1, week: 1 },
        ttffP50: 2000,
        ttffP90: 2800,
      },
    ]);
    // Already done: nothing is recomputed (the reports may be half-pruned by then).
    await db.execute(sql`delete from playback_reports`);
    expect(await rollupDailyStats(db, now)).toBe(false);
    expect(await db.select().from(schema.dailyStats)).toHaveLength(2);
  });
});
