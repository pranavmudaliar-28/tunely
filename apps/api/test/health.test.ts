import { expect, test } from 'vitest';
import { testApp } from './helpers';

test('GET /v1/health', async () => {
  const { app } = testApp();
  const res = await app.inject({ method: 'GET', url: '/v1/health' });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ status: 'ok' });
});
