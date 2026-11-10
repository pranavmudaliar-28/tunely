import { expect, test } from 'vitest';
import { keyBytes } from './push';

test('keyBytes decodes a base64url VAPID key', () => {
  // 65 bytes, uncompressed P-256 point: starts with 0x04.
  const key = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
  const bytes = keyBytes(key);
  expect(bytes).toHaveLength(65);
  expect(bytes[0]).toBe(4);
  expect(keyBytes('AQID')).toEqual(new Uint8Array([1, 2, 3]));
});
