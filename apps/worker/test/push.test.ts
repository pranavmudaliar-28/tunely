import { createDb } from '@tunely/db';
import { PUSH_REMINDERS_KEY } from '@tunely/shared';
import { sql } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import type { CheckResult } from '../src/health/check-stream';
import { runCatalogSync } from '../src/jobs/catalog-sync';
import { runHealthBatch } from '../src/jobs/health';
import { backOnlineNotice, notifyBackOnline, reseedReminders, sendDueReminders } from '../src/push/notify';
import { fixtureCatalog } from './fixtures/catalog';

const sent = vi.hoisted(() => [] as { endpoint: string; payload: string }[]);
vi.mock('web-push', () => ({
  default: {
    sendNotification: vi.fn(async (sub: { endpoint: string }, payload: string) => {
      if (sub.endpoint.endsWith('/gone')) throw Object.assign(new Error('gone'), { statusCode: 410 });
      sent.push({ endpoint: sub.endpoint, payload });
      return { statusCode: 201 };
    }),
  },
}));

test('backOnlineNotice reads naturally', () => {
  expect(backOnlineNotice([{ id: 'A.us', name: 'A' }])).toMatchObject({ title: 'A is back', url: '/watch/A.us' });
  expect(backOnlineNotice(['A', 'B'].map((n) => ({ id: n, name: n }))).body).toBe('A and B');
  expect(backOnlineNotice(['A', 'B', 'C', 'D'].map((n) => ({ id: n, name: n }))).body).toBe('A, B, C and 1 more');
});

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('push jobs (database)', () => {
  const { db, pool } = createDb(url ?? '');
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { lazyConnect: true });
  const cfg = { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:test@example.com' };
  const sub = async (endpoint: string) =>
    (
      await db.execute<{ id: string }>(sql`insert into push_subscriptions (endpoint, p256dh, auth)
        values (${endpoint}, 'p', 'a') returning id`)
    ).rows[0]!.id;
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

  beforeAll(async () => {
    await redis.connect().catch(() => {});
    await db.execute(sql`truncate channels, feeds, streams, logos, countries, categories, languages, blocklist,
      channel_curation, sync_runs, stream_health, stream_checks, playback_reports`);
    await runCatalogSync(db, fixtureCatalog());
    // DD News live, DW News offline.
    await runHealthBatch(db, { checker: async (s) => (s.url.includes('dw') ? { ...good, ok: false } : good) });
  });
  beforeEach(async () => {
    sent.length = 0;
    await redis.del(PUSH_REMINDERS_KEY);
    await db.execute(sql`truncate push_subscriptions, push_follows, push_reminders`);
  });
  afterAll(async () => {
    await redis.quit();
    await pool.end();
  });

  test('a followed channel that is live again is announced once, then forgotten', async () => {
    const id = await sub('https://fcm.googleapis.com/fcm/send/a');
    await db.execute(sql`insert into push_follows (subscription_id, channel_id) values
      (${id}, 'DDNews.in'), (${id}, 'DWNews.de')`);
    expect(await notifyBackOnline(db, cfg)).toBe(1);
    expect(JSON.parse(sent[0]!.payload)).toMatchObject({ title: 'DDNews is back', url: '/watch/DDNews.in' });
    const { rows } = await db.execute(sql`select channel_id from push_follows`);
    expect(rows).toEqual([{ channel_id: 'DWNews.de' }]); // still offline: still waiting
    expect(await notifyBackOnline(db, cfg)).toBe(0);
  });

  test('a subscription the push service says is gone is deleted', async () => {
    const id = await sub('https://fcm.googleapis.com/fcm/send/gone');
    await db.execute(sql`insert into push_follows (subscription_id, channel_id) values (${id}, 'DDNews.in')`);
    expect(await notifyBackOnline(db, cfg)).toBe(0);
    expect((await db.execute(sql`select 1 from push_subscriptions`)).rows).toEqual([]);
  });

  test('due reminders are sent once; reseeding restores the queue from the database', async () => {
    const id = await sub('https://fcm.googleapis.com/fcm/send/b');
    const start = new Date(Date.now() + 3 * 60_000);
    start.setMilliseconds(0);
    await db.execute(sql`insert into push_reminders (subscription_id, channel_id, start, title)
      values (${id}, 'DDNews.in', ${start.toISOString()}, 'Evening News')`);
    expect(await reseedReminders(db, redis, 5 * 60_000)).toBe(1); // Redis lost it; the database has it
    expect(await sendDueReminders(db, redis, cfg)).toBe(1);
    expect(JSON.parse(sent[0]!.payload)).toMatchObject({
      title: 'Starting soon: Evening News',
      body: 'DDNews · tap to watch',
    });
    expect(await sendDueReminders(db, redis, cfg)).toBe(0);
    expect((await db.execute(sql`select 1 from push_reminders`)).rows).toEqual([]);
  });
});
