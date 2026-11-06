import { expect, test } from 'vitest';
import { nowAndNext, timeLeft } from './schedule';

const slot = (title: string, start: string, stop: string) => ({ title, description: null, start, stop });
const schedule = [
  slot('Morning', '2026-11-06T09:00:00Z', '2026-11-06T10:00:00Z'),
  slot('News', '2026-11-06T10:00:00Z', '2026-11-06T10:30:00Z'),
  slot('Film', '2026-11-06T10:30:00Z', '2026-11-06T12:30:00Z'),
];
const at = (iso: string) => Date.parse(iso);

test('nowAndNext follows the clock, not the order the API sent', () => {
  expect(nowAndNext(schedule, at('2026-11-06T09:30:00Z'))).toEqual({
    current: schedule[0],
    next: schedule[1],
  });
  // The page was cached at 09:30; viewed at 10:10 it still shows what's on.
  expect(nowAndNext(schedule, at('2026-11-06T10:10:00Z'))).toEqual({
    current: schedule[1],
    next: schedule[2],
  });
  expect(nowAndNext(schedule, at('2026-11-06T08:00:00Z'))).toEqual({ current: undefined, next: schedule[0] });
  expect(nowAndNext(schedule, at('2026-11-06T13:00:00Z'))).toEqual({ current: undefined, next: undefined });
});

test('timeLeft rounds to minutes, never zero', () => {
  expect(timeLeft('2026-11-06T10:30:00Z', at('2026-11-06T10:07:00Z'))).toBe('23 min left');
  expect(timeLeft('2026-11-06T12:30:00Z', at('2026-11-06T11:10:00Z'))).toBe('1 h 20 min left');
  expect(timeLeft('2026-11-06T12:30:00Z', at('2026-11-06T10:30:00Z'))).toBe('2 h left');
  expect(timeLeft('2026-11-06T10:30:00Z', at('2026-11-06T10:29:50Z'))).toBe('1 min left');
});
