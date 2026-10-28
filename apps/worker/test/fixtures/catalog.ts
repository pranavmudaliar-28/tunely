import type { RawCatalog } from '../../src/jobs/catalog-sync';

const channel = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id.split('.')[0],
  alt_names: [],
  network: null,
  owners: [],
  country: id.endsWith('.in') ? 'IN' : 'DE',
  categories: ['news'],
  is_nsfw: false,
  launched: null,
  closed: null,
  replaced_by: null,
  website: 'https://example.com/',
  ...extra,
});

export function fixtureCatalog(): RawCatalog {
  return {
    channels: [
      channel('DDNews.in'),
      channel('DWNews.de'),
      channel('Blocked.de'),
      channel('Adult.de', { is_nsfw: true }),
      { id: 'Broken.de' }, // invalid: missing fields
    ],
    feeds: [
      {
        channel: 'DDNews.in',
        id: 'SD',
        name: 'SD',
        alt_names: [],
        is_main: true,
        broadcast_area: ['c/IN'],
        timezones: [],
        languages: ['hin'],
        format: '720p',
      },
      { channel: 'Blocked.de', id: 'SD', name: 'SD', is_main: true, languages: ['deu'] },
    ],
    streams: [
      {
        channel: 'DDNews.in',
        feed: 'SD',
        title: 'DD News',
        url: 'https://example.com/dd.m3u8',
        quality: '720p',
        labels: [],
        user_agent: null,
        referrer: null,
      },
      {
        channel: 'DWNews.de',
        feed: null,
        title: 'DW',
        url: 'https://example.com/dw.m3u8',
        quality: '1080p',
        labels: [],
        user_agent: null,
        referrer: null,
      },
      {
        channel: 'Blocked.de',
        feed: null,
        title: 'B',
        url: 'https://example.com/b.m3u8',
        quality: null,
        labels: [],
      },
      {
        channel: 'DWNews.de',
        feed: null,
        title: 'evil',
        url: 'javascript:alert(1)',
        quality: null,
        labels: [],
      },
      {
        channel: 'DWNews.de',
        feed: null,
        title: 'local',
        url: 'http://192.168.1.10/x.m3u8',
        quality: null,
        labels: [],
      },
      {
        channel: null,
        feed: null,
        title: 'orphan',
        url: 'https://example.com/o.m3u8',
        quality: null,
        labels: [],
      },
    ],
    logos: [
      {
        channel: 'DDNews.in',
        feed: null,
        in_use: true,
        tags: [],
        width: 100,
        height: 100,
        format: 'PNG',
        url: 'https://example.com/dd.png',
      },
    ],
    categories: [{ id: 'news', name: 'News', description: 'News' }],
    countries: [
      { name: 'India', code: 'IN', languages: ['hin'], flag: '🇮🇳' },
      { name: 'Germany', code: 'DE', languages: ['deu'], flag: '🇩🇪' },
    ],
    languages: [
      { code: 'hin', name: 'Hindi' },
      { code: 'deu', name: 'German' },
    ],
    blocklist: [{ channel: 'Blocked.de', reason: 'dmca', ref: 'https://example.com/issue' }],
  };
}
