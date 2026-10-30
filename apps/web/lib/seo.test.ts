import { describe, expect, test } from 'vitest';
import type { Channel, Facets } from '@tunely/shared';
import {
  browseIntro,
  channelAbout,
  describable,
  facetRobots,
  INDEX_MIN_LIVE,
  jsonLdString,
  liveDescription,
  liveTotal,
  nameLookup,
  topNames,
} from './seo';

const channel: Channel = {
  id: 'SunTV.in',
  name: 'Sun TV',
  country: 'IN',
  categories: ['entertainment', 'movies'],
  languages: ['tam'],
  logo: null,
  quality: '1080p',
  status: 'live',
  website: null,
  streams: [],
};

describe('channelAbout', () => {
  test('describes a live channel from its catalog data', () => {
    const text = channelAbout(
      channel,
      { tam: 'Tamil' },
      { entertainment: 'Entertainment', movies: 'Movies' },
    );
    expect(text).toContain('Sun TV is a TV channel from India, broadcasting in Tamil.');
    expect(text).toContain('listed under Entertainment and Movies.');
    expect(text).toContain('(up to 1080p)');
  });

  test('copes with missing languages, categories and quality', () => {
    const text = channelAbout(
      { ...channel, languages: [], categories: [], quality: null, status: 'offline' },
      {},
      {},
    );
    expect(text).toMatch(/^Sun TV is a TV channel from India\. Its stream isn't playing right now/);
  });
});

test('browseIntro', () => {
  expect(browseIntro('from India', 4120)).toMatch(/^Tunely lists 4,120 TV channels from India\. Live/);
  expect(browseIntro('from India', undefined)).toMatch(/^Live channels come first/);
});

test('jsonLdString cannot close the script tag', () => {
  expect(jsonLdString({ name: '</script><script>alert(1)</script>' })).not.toContain('</script>');
});

test('facet pages below the live-channel threshold stay out of search', () => {
  expect(facetRobots(661)).toBeUndefined();
  expect(facetRobots(INDEX_MIN_LIVE - 1)).toEqual({ index: false, follow: true });
  expect(facetRobots(0)).toEqual({ index: false, follow: true });
  expect(facetRobots(undefined)).toBeUndefined(); // counts unavailable: don't hide everything
});

test('facet descriptions use live counts and the biggest options', () => {
  const counts: Facets = {
    countries: [],
    categories: [
      { id: 'general', count: 90 },
      { id: 'news', count: 253 },
      { id: 'religious', count: 98 },
    ],
    languages: [
      { id: 'tam', count: 82 },
      { id: 'hin', count: 252 },
      { id: 'xyz', count: 300 }, // no name known: skipped
      { id: 'tel', count: 64 },
    ],
    statuses: [
      { id: 'live', count: 661 },
      { id: 'offline', count: 400 },
    ],
  };
  const langNames = nameLookup([
    { id: 'hin', name: 'Hindi' },
    { id: 'tam', name: 'Tamil' },
    { id: 'tel', name: 'Telugu' },
  ]);
  expect(liveTotal(counts)).toBe(661);
  expect(topNames(counts.languages, langNames)).toEqual(['Hindi', 'Tamil', 'Telugu']);
  expect(describable(counts.categories).map((c) => c.id)).toEqual(['news', 'religious']);
  expect(liveDescription(661, 'TV channels from India', ['in Hindi, Tamil, and Telugu', ''])).toBe(
    '661 TV channels from India are live now, in Hindi, Tamil, and Telugu. Watch free in your browser on phone, computer or TV. No app, no sign-up.',
  );
  expect(liveDescription(0, 'TV channels from Tuvalu', [])).toMatch(
    /^See all the TV channels from Tuvalu we know of/,
  );
  expect(browseIntro('from India', 1582, 661)).toMatch(
    /^Tunely lists 1,582 TV channels from India, 661 of them live now\./,
  );
});
