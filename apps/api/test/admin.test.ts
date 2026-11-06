import { describe, expect, test } from 'vitest';
import { redis, testApp, testDb, testDbUrl } from './helpers';
import { seed } from './seed';

test('POST /v1/admin/sync needs the admin token', async () => {
  const { app, added } = testApp();
  expect((await app.inject({ method: 'POST', url: '/v1/admin/sync' })).statusCode).toBe(401);
  expect(
    (await app.inject({ method: 'POST', url: '/v1/admin/sync', headers: { authorization: 'Bearer wrong' } }))
      .statusCode,
  ).toBe(401);
  const ok = await app.inject({
    method: 'POST',
    url: '/v1/admin/sync',
    headers: { authorization: 'Bearer test-admin-token' },
  });
  expect(ok.statusCode).toBe(202);
  expect(added).toEqual([{ name: 'catalog-sync' }]);
});

test('admin is closed when no token is configured', async () => {
  const { app } = testApp({ adminToken: 'change-me' });
  const res = await app.inject({
    method: 'POST',
    url: '/v1/admin/sync',
    headers: { authorization: 'Bearer change-me' },
  });
  expect(res.statusCode).toBe(401);
});

describe.skipIf(!testDbUrl)('POST /v1/admin/curate', () => {
  test('takes a channel down at once, cached responses included, and needs the token', async () => {
    const { db, pool } = testDb();
    const { app } = testApp({ db, rateLimitPerMin: 10_000 });
    await redis.connect().catch(() => {});
    await redis.flushdb();
    await seed(db);
    const curate = (payload: object, token = 'test-admin-token') =>
      app.inject({
        method: 'POST',
        url: '/v1/admin/curate',
        headers: { authorization: `Bearer ${token}` },
        payload,
      });
    const detail = () => app.inject({ method: 'GET', url: '/v1/channels/DDNews.in' });

    expect((await detail()).statusCode).toBe(200);
    expect((await detail()).headers['x-cache']).toBe('hit'); // now served from Redis

    expect((await curate({ ids: ['DDNews.in'], status: 'removed' }, 'wrong')).statusCode).toBe(401);
    expect((await curate({ ids: [], status: 'removed' })).statusCode).toBe(400);
    const res = await curate({ ids: ['DDNews.in', 'DDNews.in'], status: 'removed', reason: 'DMCA' });
    expect(res.json()).toEqual({ updated: 1, cacheCleared: true });
    expect((await detail()).statusCode).toBe(404);

    await curate({ ids: ['DDNews.in'], status: 'approved' });
    expect((await detail()).statusCode).toBe(200);
    await app.close();
    await pool.end();
  });
});
