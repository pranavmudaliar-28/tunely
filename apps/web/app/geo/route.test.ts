import { expect, test } from 'vitest';
import { GET } from './route';

const country = async (header?: string) =>
  (
    await GET(
      new Request('http://x/geo', { headers: header ? { 'x-vercel-ip-country': header } : {} }),
    ).json()
  ).country;

test('geo returns a valid country code or null, never cached', async () => {
  expect(await country('us')).toBe('US');
  expect(await country()).toBeNull();
  expect(await country('XX')).toBeNull(); // Vercel's "unknown"
  expect(await country('<script>')).toBeNull();
  expect(GET(new Request('http://x/geo')).headers.get('cache-control')).toBe('private, no-store');
});
