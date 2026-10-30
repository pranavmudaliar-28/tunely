import { Redis } from 'ioredis';
import { afterAll, describe, expect, test } from 'vitest';
import { REDIS_OPTIONS } from '../src/cache';
import { testApp, testDb, testDbUrl } from './helpers';

describe.skipIf(!testDbUrl)('with Redis down', () => {
  const { db, pool } = testDb();
  const dead = new Redis('redis://127.0.0.1:1', REDIS_OPTIONS); // nothing listens on port 1
  dead.on('error', () => {}); // ioredis logs every failed reconnect otherwise

  afterAll(async () => {
    dead.disconnect();
    await pool.end();
  });

  test('the API answers from Postgres and reports itself degraded', async () => {
    const { app } = testApp({ db, redis: dead });
    // More than one request: a queued-up connection can answer the first and stall the rest.
    for (const url of ['/v1/countries', '/v1/countries', '/v1/categories']) {
      expect((await app.inject({ url })).statusCode).toBe(200);
    }
    expect((await app.inject({ url: '/v1/health/details' })).statusCode).toBe(503);
    await app.close();
  });
});
