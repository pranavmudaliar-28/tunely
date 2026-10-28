import { expect, test } from 'vitest';
import { testApp } from './helpers';

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
