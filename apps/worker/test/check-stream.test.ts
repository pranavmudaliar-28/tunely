import { MockAgent } from 'undici';
import { expect, test } from 'vitest';
import { checkStream, isWebPlayable } from '../src/health/check-stream';
import { parsePlaylist } from '../src/health/m3u8';

const MASTER = [
  '#EXTM3U',
  '#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720',
  '720/index.m3u8',
  '#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360',
  '360/index.m3u8',
].join('\n');
const MEDIA = [
  '#EXTM3U',
  '#EXT-X-TARGETDURATION:6',
  '#EXTINF:6.0,',
  'seg1.ts',
  '#EXTINF:6.0,',
  'seg2.ts',
].join('\n');
const cors = { headers: { 'access-control-allow-origin': '*' } };
const plain = (url: string) => ({ url, referrer: null, userAgent: null });

test('parsePlaylist reads variants and segments', () => {
  expect(parsePlaylist(MASTER)).toEqual({
    kind: 'master',
    variants: [
      { uri: '720/index.m3u8', bandwidth: 2500000, height: 720 },
      { uri: '360/index.m3u8', bandwidth: 800000, height: 360 },
    ],
  });
  expect(parsePlaylist(MEDIA)).toEqual({ kind: 'media', segments: ['seg1.ts', 'seg2.ts'] });
  expect(parsePlaylist('<html>')).toBeNull();
});

function mockAgent() {
  const agent = new MockAgent();
  agent.disableNetConnect();
  return { agent, pool: agent.get('https://tv.example') };
}

test('a healthy CORS-enabled https stream is web playable', async () => {
  const { agent, pool } = mockAgent();
  pool.intercept({ path: '/live/master.m3u8' }).reply(200, MASTER, cors);
  pool.intercept({ path: '/live/360/index.m3u8' }).reply(200, MEDIA, cors);
  pool.intercept({ path: '/live/360/seg2.ts' }).reply(200, Buffer.alloc(1000), cors);
  const r = await checkStream(plain('https://tv.example/live/master.m3u8'), { dispatcher: agent });
  expect(r).toMatchObject({ ok: true, isHttps: true, hasCors: true, height: 720, errorCode: null });
  expect(isWebPlayable(r)).toBe(true);
});

test('missing CORS on the segment makes it native-only', async () => {
  const { agent, pool } = mockAgent();
  pool.intercept({ path: '/a.m3u8' }).reply(200, MEDIA, cors);
  pool.intercept({ path: '/seg2.ts' }).reply(200, Buffer.alloc(10));
  const r = await checkStream(plain('https://tv.example/a.m3u8'), { dispatcher: agent });
  expect(r).toMatchObject({ ok: true, hasCors: false });
  expect(isWebPlayable(r)).toBe(false);
});

test('streams that need a referrer are not web playable', async () => {
  const { agent, pool } = mockAgent();
  pool.intercept({ path: '/a.m3u8', headers: { referer: 'https://site.example/' } }).reply(200, MEDIA, cors);
  pool.intercept({ path: '/seg2.ts' }).reply(200, Buffer.alloc(10), cors);
  const r = await checkStream(
    { url: 'https://tv.example/a.m3u8', referrer: 'https://site.example/', userAgent: null },
    { dispatcher: agent },
  );
  expect(r).toMatchObject({ ok: true, needsHeaders: true });
  expect(isWebPlayable(r)).toBe(false);
});

test('records http errors and non-playlists', async () => {
  const { agent, pool } = mockAgent();
  pool.intercept({ path: '/geo.m3u8' }).reply(403, 'no');
  pool.intercept({ path: '/html.m3u8' }).reply(200, '<html></html>', cors);
  expect(await checkStream(plain('https://tv.example/geo.m3u8'), { dispatcher: agent })).toMatchObject({
    ok: false,
    httpStatus: 403,
    errorCode: 'http_403',
  });
  expect(await checkStream(plain('https://tv.example/html.m3u8'), { dispatcher: agent })).toMatchObject({
    ok: false,
    errorCode: 'not_m3u8',
  });
});
