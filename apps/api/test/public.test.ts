import { refreshPublicChannels } from '@tunely/db';
import { REPORTS_BUFFER } from '@tunely/shared';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { redis, testApp, testDb, testDbUrl } from './helpers';
import { seed, STREAM } from './seed';

describe.skipIf(!testDbUrl)('public API', () => {
  const { db, pool } = testDb();
  const { app } = testApp({ db, rateLimitPerMin: 10_000 });
  const get = async (url: string) => {
    const res = await app.inject({ method: 'GET', url });
    return { status: res.statusCode, body: res.json(), headers: res.headers };
  };
  const ids = (body: { items: { id: string }[] }) => body.items.map((i) => i.id);

  beforeAll(async () => {
    await redis.connect().catch(() => {});
    await seed(db);
  });
  beforeEach(async () => {
    await redis.flushdb();
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  test('lists every channel, live ones first, then A–Z', async () => {
    const { status, body } = await get('/v1/channels');
    expect(status).toBe(200);
    expect(ids(body)).toEqual([
      'DDNational.in',
      'DDNews.in',
      'DWNews.de',
      'France24.fr',
      'Pending.in',
      'Dead.in',
    ]);
    expect(body.items.at(-1)).toMatchObject({ id: 'Dead.in', status: 'offline', quality: null });
    expect(body.items[1]).toEqual({
      id: 'DDNews.in',
      name: 'DD News',
      country: 'IN',
      categories: ['news'],
      languages: ['hin'],
      logo: 'https://example.com/dd.png',
      quality: '720p',
      status: 'live',
    });
  });

  test('channels a curator hid or removed disappear', async () => {
    await db.execute(sql`update channel_curation set status = 'removed' where channel_id = 'Pending.in'`);
    await refreshPublicChannels(db);
    expect(ids((await get('/v1/channels')).body)).not.toContain('Pending.in');
    expect((await get('/v1/channels/Pending.in')).status).toBe(404);
    await db.execute(sql`update channel_curation set status = 'pending' where channel_id = 'Pending.in'`);
    await refreshPublicChannels(db);
    await redis.flushdb();
  });

  test('filters by country, category and language', async () => {
    expect(ids((await get('/v1/channels?country=in')).body)).toEqual([
      'DDNational.in',
      'DDNews.in',
      'Pending.in',
      'Dead.in',
    ]);
    expect(ids((await get('/v1/channels?category=news')).body)).toEqual([
      'DDNews.in',
      'DWNews.de',
      'France24.fr',
      'Pending.in',
      'Dead.in',
    ]);
    expect(ids((await get('/v1/channels?country=IN&status=live')).body)).toEqual([
      'DDNational.in',
      'DDNews.in',
      'Pending.in',
    ]);
    expect(ids((await get('/v1/channels?status=offline')).body)).toEqual(['Dead.in']);
    expect(ids((await get('/v1/channels?language=eng')).body)).toEqual(['DWNews.de', 'France24.fr']);
  });

  test('searches names and alternative names', async () => {
    expect(ids((await get('/v1/channels?q=dd%20n')).body).sort()).toEqual(['DDNational.in', 'DDNews.in']);
    expect(ids((await get('/v1/channels?q=doordarshan')).body)).toEqual(['DDNational.in']);
    expect(ids((await get('/v1/channels?q=pending')).body)).toEqual(['Pending.in']);
  });

  test('search matches networks, and real matches beat fuzzy look-alikes', async () => {
    await db.execute(sql`update channels set network = 'Doordarshan' where id = 'DDNews.in'`);
    await db.execute(
      sql`insert into channels (id, name, country_code) values ('Darshan.in', 'Darshan TV', 'IN')`,
    );
    await refreshPublicChannels(db);
    await redis.flushdb();
    const found = ids((await get('/v1/channels?q=doordarshan')).body);
    expect(found.slice(0, 2).sort()).toEqual(['DDNational.in', 'DDNews.in']); // alt name, network
    await db.execute(sql`update channels set network = null where id = 'DDNews.in'`);
    await db.execute(sql`delete from channels where id = 'Darshan.in'`);
    await refreshPublicChannels(db);
  });

  test('sorts by letters and digits, ignoring leading symbols', async () => {
    await db.execute(
      sql`insert into channels (id, name, country_code) values ('AndB.in', '&Bee', 'IN'), ('Alpha.in', 'Alpha', 'IN'), ('Cee.in', 'Cee', 'IN')`,
    );
    await refreshPublicChannels(db);
    await redis.flushdb();
    expect(ids((await get('/v1/channels?status=no_stream')).body)).toEqual(['Alpha.in', 'AndB.in', 'Cee.in']);
    await db.execute(sql`delete from channels where id in ('AndB.in', 'Alpha.in', 'Cee.in')`);
    await refreshPublicChannels(db);
  });

  test('paginates with a cursor', async () => {
    const p1 = (await get('/v1/channels?limit=3')).body;
    expect(p1.items).toHaveLength(3);
    const p2 = (await get(`/v1/channels?limit=3&cursor=${p1.nextCursor}`)).body;
    expect(ids(p2)).toEqual(['France24.fr', 'Pending.in', 'Dead.in']);
    expect(p2.nextCursor).toBeNull();
    const s1 = (await get('/v1/channels?q=dd&limit=1')).body;
    const s2 = (await get(`/v1/channels?q=dd&limit=1&cursor=${s1.nextCursor}`)).body;
    expect(ids(s1)).toHaveLength(1);
    expect(ids(s2)).toHaveLength(1);
    expect(ids(s2)).not.toEqual(ids(s1));
    expect((await get('/v1/channels?cursor=garbage')).status).toBe(400);
    expect((await get('/v1/channels?limit=500')).status).toBe(400);
  });

  test('caches responses in Redis and sets CDN headers', async () => {
    const first = await get('/v1/channels?country=IN');
    expect(first.headers['x-cache']).toBe('miss');
    expect(first.headers['cache-control']).toContain('s-maxage=300');
    const second = await get('/v1/channels?country=IN');
    expect(second.headers['x-cache']).toBe('hit');
    expect(second.body).toEqual(first.body);
  });

  test('channel detail returns usable streams by score; dead channels have none', async () => {
    const { status, body } = await get('/v1/channels/DDNews.in');
    expect(status).toBe(200);
    expect(body.website).toBe('https://ddnews.gov.in/');
    expect(body.streams.map((s: { id: string }) => s.id)).toEqual([
      STREAM.dd,
      STREAM.ddBackup,
      STREAM.native,
    ]);
    expect(body.streams[2]).toMatchObject({ webPlayable: false, nativePlayable: true, quality: '1080p' });
    const dead = await get('/v1/channels/Dead.in');
    expect(dead.body).toMatchObject({ status: 'offline', streams: [] });
    expect((await get('/v1/channels/Nope.xx')).status).toBe(404);
  });

  test('related channels share country or category', async () => {
    const { body } = await get('/v1/channels/DDNews.in/related');
    // Live only (it doubles as the player's channel list): Pending shares country and category, so it leads.
    expect(ids(body)).toEqual(['Pending.in', 'DDNational.in', 'DWNews.de', 'France24.fr']);
    expect((await get('/v1/channels/Nope.xx/related')).status).toBe(404);
  });

  test('facets count listed channels', async () => {
    expect((await get('/v1/countries')).body.items).toEqual([
      { id: 'IN', name: 'India', flag: 'IN-flag', count: 4 },
      { id: 'FR', name: 'France', flag: 'FR-flag', count: 1 },
      { id: 'DE', name: 'Germany', flag: 'DE-flag', count: 1 },
    ]);
    expect((await get('/v1/categories')).body.items).toEqual([
      { id: 'news', name: 'News', count: 5 },
      { id: 'general', name: 'General', count: 1 },
    ]);
    expect((await get('/v1/languages')).body.items).toEqual([
      { id: 'eng', name: 'English', count: 2 },
      { id: 'fra', name: 'French', count: 1 },
      { id: 'hin', name: 'Hindi', count: 1 },
    ]);
  });

  test('trending ranks by distinct viewers in the last 24 h', async () => {
    await db.execute(sql`insert into playback_reports (stream_id, platform, result, anon_session_hash, created_at) values
      (${STREAM.dw}, 'web', 'ok', 'a', now()), (${STREAM.dw}, 'web', 'ok', 'b', now()), (${STREAM.dw}, 'web', 'ok', 'b', now()),
      (${STREAM.dd}, 'web', 'ok', 'a', now()), (${STREAM.dd}, 'web', 'error', 'c', now()),
      (${STREAM.f24}, 'web', 'ok', 'a', now() - interval '2 days'),
      (${STREAM.pending}, 'web', 'ok', 'z', now())`);
    const { body } = await get('/v1/trending');
    expect(body.items.map((i: { id: string; viewers: number }) => [i.id, i.viewers])).toEqual([
      ['DWNews.de', 2],
      ['DDNews.in', 1],
      ['Pending.in', 1],
    ]);
  });

  test('playback reports are buffered with a hashed session, never the raw id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/playback-reports',
      payload: {
        streamId: STREAM.dd,
        platform: 'web',
        result: 'ok',
        ttffMs: 1200,
        sessionId: 'session-abc-123',
      },
    });
    expect(res.statusCode).toBe(202);
    const [entry] = await redis.lrange(REPORTS_BUFFER, 0, -1);
    const parsed = JSON.parse(entry!);
    expect(parsed).toMatchObject({ streamId: STREAM.dd, result: 'ok', ttffMs: 1200 });
    expect(parsed.anonSessionHash).toMatch(/^[0-9a-f]{32}$/);
    expect(entry).not.toContain('session-abc-123');

    const bad = await app.inject({ method: 'POST', url: '/v1/playback-reports', payload: { streamId: 'x' } });
    expect(bad.statusCode).toBe(400);
  });

  test('OpenAPI spec is published at /v1/docs', async () => {
    const { status, body } = await get('/v1/docs/json');
    expect(status).toBe(200);
    const paths = Object.keys(body.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/v1/channels',
        '/v1/channels/{id}',
        '/v1/countries',
        '/v1/trending',
        '/v1/playback-reports',
      ]),
    );
    expect(paths).not.toContain('/v1/admin/sync');
  });
});
