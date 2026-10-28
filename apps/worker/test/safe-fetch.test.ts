import { MockAgent } from 'undici';
import { describe, expect, test } from 'vitest';
import { isBlockedAddress, safeFetch, safeLookup } from '../src/net/safe-fetch';

describe('isBlockedAddress', () => {
  test.each([
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '0.0.0.0',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '100.64.0.1',
    '64:ff9b::a00:1',
    '64:ff9b::7f00:1',
    'not-an-ip',
  ])('blocks %s', (ip) => expect(isBlockedAddress(ip)).toBe(true));
  test.each(['8.8.8.8', '172.32.0.1', '2606:4700:4700::1111', '64:ff9b::b2da:ccd9'])('allows %s', (ip) =>
    expect(isBlockedAddress(ip)).toBe(false),
  );
});

test('DNS names that resolve to loopback are refused', async () => {
  const err = await new Promise<Error | null>((resolve) => safeLookup('localhost', {}, (e) => resolve(e)));
  expect(err?.message).toMatch(/resolves to/);
});

test('literal private IPs and bad schemes are refused before connecting', async () => {
  await expect(safeFetch('http://127.0.0.1:4000/', { maxBytes: 100 })).rejects.toMatchObject({
    code: 'blocked_ip',
  });
  await expect(safeFetch('http://[::1]/', { maxBytes: 100 })).rejects.toMatchObject({ code: 'blocked_ip' });
  await expect(safeFetch('file:///etc/passwd', { maxBytes: 100 })).rejects.toMatchObject({ code: 'bad_url' });
});

function mock() {
  const agent = new MockAgent();
  agent.disableNetConnect();
  return { agent, pool: agent.get('https://tv.example') };
}

test('redirect to a private address is refused', async () => {
  const { agent, pool } = mock();
  pool.intercept({ path: '/a.m3u8' }).reply(302, '', { headers: { location: 'http://10.0.0.5/admin' } });
  await expect(
    safeFetch('https://tv.example/a.m3u8', { maxBytes: 100, dispatcher: agent }),
  ).rejects.toMatchObject({ code: 'blocked_ip' });
});

test('stops after 3 redirects', async () => {
  const { agent, pool } = mock();
  pool
    .intercept({ path: '/loop' })
    .reply(302, '', { headers: { location: '/loop' } })
    .times(5);
  await expect(
    safeFetch('https://tv.example/loop', { maxBytes: 100, dispatcher: agent }),
  ).rejects.toMatchObject({ code: 'too_many_redirects' });
});

test('follows a redirect and enforces the size cap', async () => {
  const { agent, pool } = mock();
  pool.intercept({ path: '/a' }).reply(301, '', { headers: { location: '/b' } });
  pool.intercept({ path: '/b' }).reply(200, '#EXTM3U\n', { headers: { 'access-control-allow-origin': '*' } });
  const res = await safeFetch('https://tv.example/a', { maxBytes: 100, dispatcher: agent });
  expect(res).toMatchObject({ url: 'https://tv.example/b', status: 200, truncated: false });
  expect(res.headers['access-control-allow-origin']).toBe('*');

  pool.intercept({ path: '/big' }).reply(200, 'x'.repeat(500));
  await expect(
    safeFetch('https://tv.example/big', { maxBytes: 100, dispatcher: agent }),
  ).rejects.toMatchObject({ code: 'too_large' });
  pool.intercept({ path: '/big' }).reply(200, 'x'.repeat(500));
  const partial = await safeFetch('https://tv.example/big', {
    maxBytes: 1000,
    readBytes: 10,
    dispatcher: agent,
  });
  expect(partial.truncated).toBe(true);
});
