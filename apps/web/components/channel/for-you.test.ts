import type { ChannelSummary } from '@tunely/shared';
import { expect, test } from 'vitest';
import { topInterest } from './for-you';

const now = Date.parse('2026-11-06T12:00:00Z');
const entry = (id: string, categories: string[], languages: string[], watchSeconds: number, daysAgo = 0) => ({
  channel: {
    id,
    name: id,
    country: 'IN',
    categories,
    languages,
    logo: null,
    quality: null,
    status: 'live',
  } as ChannelSummary,
  lastWatchedAt: now - daysAgo * 86_400_000,
  watchSeconds,
});

test('needs a few channels before it guesses', () => {
  expect(
    topInterest([entry('a', ['news'], ['tam'], 600), entry('b', ['news'], ['tam'], 600)], now),
  ).toBeNull();
});

test('the category and language with the most recent watch time win', () => {
  const history = [
    entry('a', ['news'], ['tam'], 3600),
    entry('b', ['news'], ['tam'], 1800),
    entry('c', ['movies'], ['hin'], 3000),
  ];
  expect(topInterest(history, now)).toEqual({ category: 'news', language: 'tam' });
});

test('old habits fade: a month ago counts less than today', () => {
  const history = [
    entry('a', ['sports'], ['eng'], 7200, 30), // two hours, a month ago
    entry('b', ['kids'], ['hin'], 1800, 0), // half an hour today
    entry('c', ['kids'], ['hin'], 600, 1),
  ];
  expect(topInterest(history, now)).toEqual({ category: 'kids', language: 'hin' });
});
