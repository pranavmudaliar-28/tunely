import { WORKER_HEARTBEAT_KEY } from '@tunely/shared';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { redis, testApp } from './helpers';

beforeAll(async () => {
  await redis.connect().catch(() => {});
});
beforeEach(() => redis.del(WORKER_HEARTBEAT_KEY));
afterAll(() => redis.del(WORKER_HEARTBEAT_KEY));

const details = async () => {
  const { app } = testApp();
  const res = await app.inject({ method: 'GET', url: '/v1/health/details' });
  await app.close();
  return { code: res.statusCode, body: res.json() };
};

test('ok when Redis answers and the worker beat recently', async () => {
  await redis.set(WORKER_HEARTBEAT_KEY, Date.now() - 30_000);
  const { code, body } = await details();
  expect(code).toBe(200);
  expect(body).toMatchObject({ status: 'ok', redis: 'ok', worker: { status: 'ok', lastSeenSecondsAgo: 30 } });
});

test('503 when the worker heartbeat is stale or missing', async () => {
  await redis.set(WORKER_HEARTBEAT_KEY, Date.now() - 10 * 60_000);
  expect(await details()).toMatchObject({
    code: 503,
    body: { status: 'degraded', worker: { status: 'stale' } },
  });
  await redis.del(WORKER_HEARTBEAT_KEY);
  expect(await details()).toMatchObject({
    code: 503,
    body: { worker: { status: 'unknown', lastSeenSecondsAgo: null } },
  });
});

test('health endpoints answer HEAD (some pingers use it) and are never rate limited', async () => {
  const { app } = testApp({ rateLimitPerMin: 1 });
  for (let i = 0; i < 5; i++) {
    expect(
      (await app.inject({ method: 'HEAD', url: '/v1/health', remoteAddress: '203.0.113.9' })).statusCode,
    ).toBe(200);
  }
  await app.close();
});
