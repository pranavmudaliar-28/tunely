import { describe, expect, test } from 'vitest';
import type { Channel } from '@tunely/shared';
import { browseIntro, channelAbout, jsonLdString } from './seo';

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
