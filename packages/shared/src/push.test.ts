import { expect, test } from 'vitest';
import { isPushEndpoint, PushSubscriptionSchema } from './push';

test('only known push services are accepted as endpoints', () => {
  expect(isPushEndpoint('https://fcm.googleapis.com/fcm/send/abc:def')).toBe(true);
  expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/gAAA')).toBe(true);
  expect(isPushEndpoint('https://web.push.apple.com/QGx')).toBe(true);
  expect(isPushEndpoint('https://wns2-db5p.notify.windows.com/w/?token=x')).toBe(true);
  expect(isPushEndpoint('http://fcm.googleapis.com/fcm/send/x')).toBe(false);
  expect(isPushEndpoint('https://fcm.googleapis.com:8443/x')).toBe(false);
  expect(isPushEndpoint('https://evil.example/fcm.googleapis.com')).toBe(false);
  expect(isPushEndpoint('https://fcm.googleapis.com.evil.example/x')).toBe(false);
  expect(isPushEndpoint('https://user@fcm.googleapis.com/x')).toBe(false);
  expect(isPushEndpoint('https://169.254.169.254/latest')).toBe(false);
  expect(isPushEndpoint('not a url')).toBe(false);
});

test('a browser subscription parses; odd keys do not', () => {
  const sub = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) },
  };
  expect(PushSubscriptionSchema.safeParse(sub).success).toBe(true);
  expect(PushSubscriptionSchema.safeParse({ ...sub, keys: { ...sub.keys, auth: 'x' } }).success).toBe(false);
  expect(PushSubscriptionSchema.safeParse({ ...sub, endpoint: 'https://evil.example/x' }).success).toBe(false);
});
