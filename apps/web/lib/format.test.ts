import { expect, test } from 'vitest';
import { watchTime } from './format';

test('watchTime rounds down to minutes and hours', () => {
  expect(watchTime(0)).toBe('Under a minute');
  expect(watchTime(59)).toBe('Under a minute');
  expect(watchTime(45 * 60 + 30)).toBe('45 min');
  expect(watchTime(2 * 3600)).toBe('2 h');
  expect(watchTime(2 * 3600 + 10 * 60)).toBe('2 h 10 min');
});
