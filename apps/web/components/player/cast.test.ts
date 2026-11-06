import { expect, test } from 'vitest';
import { canHaveCast } from './cast';

test('Cast is offered in Chromium browsers, never on iOS', () => {
  const android = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36';
  const iphone =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/131.0 Mobile';
  const firefox = 'Mozilla/5.0 (Windows NT 10.0; rv:133.0) Gecko/20100101 Firefox/133.0';
  expect(canHaveCast(android, true)).toBe(true);
  expect(canHaveCast(iphone, true)).toBe(false); // Chrome on iOS is Safari inside
  expect(canHaveCast(firefox, false)).toBe(false);
});
