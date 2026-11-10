import { refreshPublicChannels } from '@tunely/db';
import { PUSH_REMINDERS_KEY } from '@tunely/shared';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { redis, testApp, testDb, testDbUrl } from './helpers';
import { seed } from './seed';

describe.skipIf(!testDbUrl)('push API', () => {
  const { db, pool } = testDb();
  const { app } = testApp({ db, rateLimitPerMin: 10_000 });
  const post = async (url: string, payload: Record<string, unknown>) => {
    const res = await app.inject({ method: 'POST', url, payload });
    return { status: res.statusCode, body: res.json() };
  };
  const subscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
    keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) },
  };

  beforeAll(async () => {
    await redis.connect().catch(() => {});
    await seed(db);
    await refreshPublicChannels(db);
  });
  beforeEach(async () => {
    await redis.flushdb();
    await db.execute(sql`truncate push_subscriptions, push_follows, push_reminders, programmes`);
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  test('follow: only offline channels, from a known push service', async () => {
    expect((await post('/v1/push/follow', { subscription, channelId: 'Dead.in' })).status).toBe(200);
    expect((await post('/v1/push/follow', { subscription, channelId: 'Dead.in' })).status).toBe(200); // idempotent
    expect((await post('/v1/push/follow', { subscription, channelId: 'DDNews.in' })).body).toEqual({
      error: 'live now',
    });
    expect((await post('/v1/push/follow', { subscription, channelId: 'Nope.xx' })).status).toBe(404);
    const evil = { ...subscription, endpoint: 'https://169.254.169.254/latest/meta-data' };
    expect((await post('/v1/push/follow', { subscription: evil, channelId: 'Dead.in' })).status).toBe(400);
    const { rows } = await db.execute(sql`select channel_id from push_follows`);
    expect(rows).toEqual([{ channel_id: 'Dead.in' }]);
  });

  test('remind: a programme in our guide, queued 5 minutes before it starts', async () => {
    const start = new Date(Date.now() + 3600_000);
    start.setMilliseconds(0);
    await db.execute(sql`insert into programmes (channel_id, start, stop, title) values
      ('DDNews.in', ${start.toISOString()}, ${new Date(start.getTime() + 1800_000).toISOString()}, 'Evening News')`);
    const ok = await post('/v1/push/remind', { subscription, channelId: 'DDNews.in', start: start.toISOString() });
    expect(ok.status).toBe(200);
    const other = new Date(start.getTime() + 60_000).toISOString();
    expect((await post('/v1/push/remind', { subscription, channelId: 'DDNews.in', start: other })).status).toBe(404);
    const { rows } = await db.execute<{ title: string }>(sql`select title from push_reminders`);
    expect(rows).toEqual([{ title: 'Evening News' }]);
    const [member] = await redis.zrange(PUSH_REMINDERS_KEY, '0', '-1');
    expect(member).toMatch(/\|DDNews\.in\|/);
    expect(Number(await redis.zscore(PUSH_REMINDERS_KEY, member!))).toBe(start.getTime() - 5 * 60_000);
  });

  test('unsubscribe forgets the browser and everything it asked for', async () => {
    await post('/v1/push/follow', { subscription, channelId: 'Dead.in' });
    expect((await post('/v1/push/unsubscribe', { endpoint: subscription.endpoint })).status).toBe(200);
    const { rows } = await db.execute(sql`select 1 from push_subscriptions union all select 1 from push_follows`);
    expect(rows).toEqual([]);
  });
});
