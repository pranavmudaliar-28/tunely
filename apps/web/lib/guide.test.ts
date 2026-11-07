import type { ChannelSummary } from '@tunely/shared';
import { expect, test } from 'vitest';
import { guideSections } from './guide';

const ch = (id: string, categories: string[]): ChannelSummary => ({
  id,
  name: id,
  country: 'US',
  categories,
  languages: [],
  logo: null,
  quality: null,
  status: 'live',
  onAir: [],
});

test('guideSections groups by category, biggest first, keeping order', () => {
  const sections = guideSections([
    ch('A', ['news']),
    ch('B', ['sports', 'news']),
    ch('C', []),
    ch('D', ['sports']),
    ch('E', ['kids']),
  ]);
  expect(sections.map(([cat, list]) => [cat, list.map((c) => c.id)])).toEqual([
    ['news', ['A', 'B']],
    ['sports', ['B', 'D']],
    ['general', ['C']],
    ['kids', ['E']],
  ]);
});
