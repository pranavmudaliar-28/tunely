import { expect, test } from 'vitest';
import { ago, reliabilityText, watchTime } from './format';

test('watchTime rounds down to minutes and hours', () => {
  expect(watchTime(0)).toBe('Under a minute');
  expect(watchTime(59)).toBe('Under a minute');
  expect(watchTime(45 * 60 + 30)).toBe('45 min');
  expect(watchTime(2 * 3600)).toBe('2 h');
  expect(watchTime(2 * 3600 + 10 * 60)).toBe('2 h 10 min');
});

test('ago reads like speech', () => {
  const now = Date.parse('2026-11-06T12:00:00Z');
  expect(ago(now - 30_000, now)).toBe('just now');
  expect(ago(now - 12 * 60_000, now)).toBe('12 min ago');
  expect(ago(now - 3 * 3_600_000, now)).toBe('3 h ago');
  expect(ago(now - 26 * 3_600_000, now)).toBe('yesterday');
  expect(ago(now - 4 * 86_400_000, now)).toBe('4 days ago');
});

test('reliabilityText says what the checks show, and nothing when they show nothing', () => {
  const now = Date.parse('2026-11-06T12:00:00Z');
  const lastOkAt = '2026-11-06T10:00:00Z';
  expect(reliabilityText({ checks: 14, ok: 13, lastOkAt }, 'live', now)).toBe(
    'Worked in 13 of 14 checks this week · last verified 2 h ago',
  );
  expect(reliabilityText({ checks: 4, ok: 0, lastOkAt: null }, 'live', now)).toMatch(/viewers/);
  expect(reliabilityText({ checks: 0, ok: 0, lastOkAt: null }, 'live', now)).toBeNull();
  expect(reliabilityText({ checks: 5, ok: 0, lastOkAt: '2026-11-02T12:00:00Z' }, 'offline', now)).toBe(
    'Last worked 4 days ago',
  );
  expect(reliabilityText({ checks: 5, ok: 0, lastOkAt: null }, 'offline', now)).toBeNull();
  expect(reliabilityText({ checks: 5, ok: 5, lastOkAt }, 'closed', now)).toBeNull();
  expect(reliabilityText(null, 'live', now)).toBeNull();
});
