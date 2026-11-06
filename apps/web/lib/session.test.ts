import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { visitorAge, visitorAgeBucket } from './session';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

test('buckets days since the first visit', () => {
  expect(visitorAgeBucket('2026-11-06', '2026-11-06')).toBe('first_day');
  expect(visitorAgeBucket('2026-11-05', '2026-11-06')).toBe('week');
  expect(visitorAgeBucket('2026-10-30', '2026-11-06')).toBe('week');
  expect(visitorAgeBucket('2026-10-29', '2026-11-06')).toBe('month');
  expect(visitorAgeBucket('2026-10-07', '2026-11-06')).toBe('month');
  expect(visitorAgeBucket('2026-10-06', '2026-11-06')).toBe('older');
  // A clock moved back or a garbled date counts as new, never as returning.
  expect(visitorAgeBucket('2026-12-01', '2026-11-06')).toBe('first_day');
  expect(visitorAgeBucket('garbage', '2026-11-06')).toBe('first_day');
});

test('remembers the first visit date, and only the date', () => {
  expect(visitorAge(new Date('2026-11-01T10:00:00Z'))).toBe('first_day');
  expect(localStorage.getItem('tunely.first')).toBe('2026-11-01');
  expect(visitorAge(new Date('2026-11-06T10:00:00Z'))).toBe('week');
  localStorage.setItem('tunely.first', 'not a date');
  expect(visitorAge(new Date('2026-11-06T10:00:00Z'))).toBe('first_day');
});

test('blocked storage sends no bucket rather than a wrong one', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(visitorAge()).toBeUndefined();
});
