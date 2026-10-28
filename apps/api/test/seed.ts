import type { Db } from '@tunely/db';
import { sql } from 'drizzle-orm';

export const STREAM = {
  dd: '00000000-0000-4000-8000-000000000001',
  ddBackup: '00000000-0000-4000-8000-000000000002',
  dw: '00000000-0000-4000-8000-000000000003',
  f24: '00000000-0000-4000-8000-000000000004',
  pending: '00000000-0000-4000-8000-000000000005',
  dead: '00000000-0000-4000-8000-000000000006',
  native: '00000000-0000-4000-8000-000000000007',
  ddn: '00000000-0000-4000-8000-000000000008',
};

/** Six channels: four public, plus one pending and one whose only stream scores under 50. */
export async function seed(db: Db) {
  await db.execute(sql`truncate channels, feeds, streams, logos, countries, categories, languages, blocklist,
    channel_curation, stream_health, stream_checks, playback_reports`);
  await db.execute(sql`insert into countries (code, name, flag, languages) values
    ('IN', 'India', 'IN-flag', '{hin}'), ('DE', 'Germany', 'DE-flag', '{deu}'), ('FR', 'France', 'FR-flag', '{fra}')`);
  await db.execute(sql`insert into categories (id, name) values ('news', 'News'), ('general', 'General')`);
  await db.execute(
    sql`insert into languages (code, name) values ('hin', 'Hindi'), ('eng', 'English'), ('fra', 'French')`,
  );
  await db.execute(sql`insert into channels (id, name, alt_names, country_code, categories, website) values
    ('DDNews.in', 'DD News', '{}', 'IN', '{news}', 'https://ddnews.gov.in/'),
    ('DDNational.in', 'DD National', '{Doordarshan}', 'IN', '{general}', null),
    ('DWNews.de', 'DW News', '{}', 'DE', '{news}', null),
    ('France24.fr', 'France 24', '{}', 'FR', '{news}', null),
    ('Pending.in', 'Pending TV', '{}', 'IN', '{news}', null),
    ('Dead.in', 'Dead TV', '{}', 'IN', '{news}', null)`);
  await db.execute(sql`insert into feeds (channel_id, feed_id, name, is_main, languages) values
    ('DDNews.in', 'SD', 'SD', true, '{hin}'), ('DWNews.de', 'SD', 'SD', true, '{eng}'),
    ('France24.fr', 'EN', 'English', true, '{eng}'), ('France24.fr', 'FR', 'French', false, '{fra}')`);
  await db.execute(
    sql`insert into logos (channel_id, feed_id, url, width, in_use) values ('DDNews.in', '', 'https://example.com/dd.png', 100, true)`,
  );
  await db.execute(sql`insert into channel_curation (channel_id, status) values
    ('DDNews.in', 'approved'), ('DDNational.in', 'approved'), ('DWNews.de', 'approved'),
    ('France24.fr', 'approved'), ('Pending.in', 'pending'), ('Dead.in', 'approved')`);
  await db.execute(sql`insert into streams (id, channel_id, title, url, quality) values
    (${STREAM.dd}, 'DDNews.in', 'DD News', 'https://example.com/dd.m3u8', '720p'),
    (${STREAM.ddBackup}, 'DDNews.in', 'DD News backup', 'https://example.com/dd2.m3u8', null),
    (${STREAM.native}, 'DDNews.in', 'DD News native', 'http://example.com/dd3.m3u8', null),
    (${STREAM.ddn}, 'DDNational.in', 'DD National', 'https://example.com/ddn.m3u8', null),
    (${STREAM.dw}, 'DWNews.de', 'DW', 'https://example.com/dw.m3u8', '1080p'),
    (${STREAM.f24}, 'France24.fr', 'F24', 'https://example.com/f24.m3u8', null),
    (${STREAM.pending}, 'Pending.in', 'P', 'https://example.com/p.m3u8', null),
    (${STREAM.dead}, 'Dead.in', 'D', 'https://example.com/d.m3u8', null)`);
  await db.execute(sql`insert into stream_health (stream_id, score, web_playable, native_playable, height) values
    (${STREAM.dd}, 95, true, true, 720), (${STREAM.ddBackup}, 70, true, true, 576), (${STREAM.native}, 90, false, true, 1080),
    (${STREAM.ddn}, 80, true, true, null), (${STREAM.dw}, 99, true, true, 1080), (${STREAM.f24}, 60, true, true, 360),
    (${STREAM.pending}, 99, true, true, 720), (${STREAM.dead}, 30, true, true, 720)`);
}
