import { expect, test } from 'vitest';
import { parseOrigins } from '../src/cors';
import { testApp } from './helpers';

test('parseOrigins trims spaces and trailing slashes', () => {
  expect(parseOrigins(' https://web-delta-one-36.vercel.app/ , https://tunely.tv//,')).toEqual([
    'https://web-delta-one-36.vercel.app',
    'https://tunely.tv',
  ]);
  expect(parseOrigins(undefined)).toEqual([]);
});

test('a browser request from the configured site gets CORS headers', async () => {
  const { app } = testApp({ corsOrigins: parseOrigins('https://web-delta-one-36.vercel.app/') });
  const ok = await app.inject({
    method: 'GET',
    url: '/v1/health',
    headers: { origin: 'https://web-delta-one-36.vercel.app' },
  });
  expect(ok.headers['access-control-allow-origin']).toBe('https://web-delta-one-36.vercel.app');
  const other = await app.inject({
    method: 'GET',
    url: '/v1/health',
    headers: { origin: 'https://evil.example' },
  });
  expect(other.headers['access-control-allow-origin']).toBeUndefined();
  await app.close();
});
