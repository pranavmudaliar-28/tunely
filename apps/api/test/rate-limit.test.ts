import { afterAll, beforeAll, expect, test } from 'vitest';
import { redis, testApp } from './helpers';

beforeAll(async () => {
  await redis.connect().catch(() => {});
  await redis.flushdb();
});
afterAll(async () => {
  await redis.flushdb();
});

test('playback reports are limited to 20 per minute per client', async () => {
  const { app } = testApp();
  const post = () =>
    app.inject({ method: 'POST', url: '/v1/playback-reports', payload: {}, remoteAddress: '203.0.113.7' });
  for (let i = 0; i < 20; i++) expect((await post()).statusCode).toBe(400); // counted even when invalid
  expect((await post()).statusCode).toBe(429);
  await app.close();
});

test('our web server skips the rate limit with the right key, nobody else does', async () => {
  await redis.flushdb();
  const { app } = testApp({ rateLimitPerMin: 2, internalApiKey: 'server-key' });
  const get = (key?: string) =>
    app.inject({
      method: 'GET',
      url: '/v1/docs/json',
      remoteAddress: '203.0.113.9',
      headers: key ? { 'x-internal-key': key } : {},
    });
  for (let i = 0; i < 5; i++) expect((await get('server-key')).statusCode).toBe(200);
  for (let i = 0; i < 2; i++) expect((await get('wrong-key')).statusCode).toBe(200); // counted as a normal client
  expect((await get('wrong-key')).statusCode).toBe(429);
  expect((await get()).statusCode).toBe(429);
  await app.close();
});

test('with no key configured, sending the header gives no bypass', async () => {
  await redis.flushdb();
  const { app } = testApp({ rateLimitPerMin: 1 });
  const get = () =>
    app.inject({
      method: 'GET',
      url: '/v1/docs/json',
      remoteAddress: '203.0.113.10',
      headers: { 'x-internal-key': '' },
    });
  expect((await get()).statusCode).toBe(200);
  expect((await get()).statusCode).toBe(429);
  await app.close();
});

test('the global limit applies to public GETs and skips /v1/health', async () => {
  await redis.flushdb();
  const { app } = testApp({ rateLimitPerMin: 3 });
  const get = (url: string) => app.inject({ method: 'GET', url, remoteAddress: '203.0.113.8' });
  for (let i = 0; i < 3; i++) expect((await get('/v1/docs/json')).statusCode).toBe(200);
  expect((await get('/v1/docs/json')).statusCode).toBe(429);
  expect((await get('/v1/health')).statusCode).toBe(200);
  await app.close();
});
