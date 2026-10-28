import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  pgMaterializedView,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

// ---- Catalog (synced from iptv-org) ----

export const channels = pgTable(
  'channels',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    altNames: text('alt_names')
      .array()
      .notNull()
      .default(sql`'{}'`),
    network: text('network'),
    countryCode: text('country_code').notNull(),
    categories: text('categories')
      .array()
      .notNull()
      .default(sql`'{}'`),
    isNsfw: boolean('is_nsfw').notNull().default(false),
    website: text('website'),
    launched: text('launched'),
    closed: text('closed'),
    replacedBy: text('replaced_by'),
    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('channels_categories_gin').using('gin', t.categories),
    index('channels_name_trgm').using('gin', sql`${t.name} gin_trgm_ops`),
    index('channels_country_idx').on(t.countryCode),
  ],
);

export const feeds = pgTable(
  'feeds',
  {
    channelId: text('channel_id').notNull(),
    feedId: text('feed_id').notNull(),
    name: text('name').notNull(),
    isMain: boolean('is_main').notNull().default(false),
    broadcastArea: text('broadcast_area')
      .array()
      .notNull()
      .default(sql`'{}'`),
    timezones: text('timezones')
      .array()
      .notNull()
      .default(sql`'{}'`),
    languages: text('languages')
      .array()
      .notNull()
      .default(sql`'{}'`),
    format: text('format'),
  },
  (t) => [
    primaryKey({ columns: [t.channelId, t.feedId] }),
    index('feeds_languages_gin').using('gin', t.languages),
  ],
);

export const streams = pgTable(
  'streams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: text('channel_id').notNull(),
    feedId: text('feed_id'),
    title: text('title').notNull(),
    url: text('url').notNull(),
    referrer: text('referrer'),
    userAgent: text('user_agent'),
    quality: text('quality'),
    labels: text('labels')
      .array()
      .notNull()
      .default(sql`'{}'`),
    source: text('source', { enum: ['iptv-org', 'manual'] })
      .notNull()
      .default('iptv-org'),
    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('streams_url_unique').on(t.url), index('streams_channel_idx').on(t.channelId)],
);

export const logos = pgTable(
  'logos',
  {
    channelId: text('channel_id').notNull(),
    feedId: text('feed_id').notNull().default(''),
    url: text('url').notNull(),
    cdnUrl: text('cdn_url'),
    width: integer('width'),
    height: integer('height'),
    format: text('format'),
    inUse: boolean('in_use').notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.channelId, t.feedId, t.url] })],
);

export const countries = pgTable('countries', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  flag: text('flag'),
  languages: text('languages')
    .array()
    .notNull()
    .default(sql`'{}'`),
});

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
});

export const languages = pgTable('languages', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
});

export const blocklist = pgTable('blocklist', {
  channelId: text('channel_id').primaryKey(),
  reason: text('reason'),
  ref: text('ref'),
});

// ---- Health and curation (ours) ----

// Partitioned by month in the migration SQL; Drizzle only needs the column shape.
export const streamChecks = pgTable(
  'stream_checks',
  {
    id: bigserial('id', { mode: 'number' }).notNull(),
    streamId: uuid('stream_id').notNull(),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
    ok: boolean('ok').notNull(),
    httpStatus: smallint('http_status'),
    isHttps: boolean('is_https').notNull(),
    hasCors: boolean('has_cors').notNull().default(false),
    needsHeaders: boolean('needs_headers').notNull().default(false),
    latencyMs: integer('latency_ms'),
    height: integer('height'),
    errorCode: text('error_code'),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.checkedAt] }),
    index('stream_checks_stream_idx').on(t.streamId, t.checkedAt),
  ],
);

export const streamHealth = pgTable(
  'stream_health',
  {
    streamId: uuid('stream_id').primaryKey(),
    score: smallint('score').notNull().default(0),
    webPlayable: boolean('web_playable').notNull().default(false),
    nativePlayable: boolean('native_playable').notNull().default(false),
    height: integer('height'),
    lastOkAt: timestamp('last_ok_at', { withTimezone: true }),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    failStreak: integer('fail_streak').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('stream_health_web_idx').on(t.webPlayable, t.score)],
);

export const playbackReports = pgTable(
  'playback_reports',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    streamId: uuid('stream_id').notNull(),
    platform: text('platform').notNull(),
    result: text('result', { enum: ['ok', 'error'] }).notNull(),
    errorType: text('error_type'),
    ttffMs: integer('ttff_ms'),
    anonSessionHash: text('anon_session_hash').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('playback_reports_stream_time_idx').on(t.streamId, t.createdAt)],
);

export const curationStatus = ['approved', 'hidden', 'pending', 'removed'] as const;

export const channelCuration = pgTable(
  'channel_curation',
  {
    channelId: text('channel_id').primaryKey(),
    status: text('status', { enum: curationStatus }).notNull().default('pending'),
    reason: text('reason'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  },
  (t) => [index('channel_curation_status_idx').on(t.status)],
);

export const takedownRequests = pgTable('takedown_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: text('channel_id'),
  requesterName: text('requester_name').notNull(),
  requesterEmail: text('requester_email').notNull(),
  org: text('org'),
  details: text('details').notNull(),
  status: text('status', { enum: ['open', 'actioned', 'rejected'] })
    .notNull()
    .default('open'),
  createdAt: createdAt(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

export const syncRuns = pgTable('sync_runs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: text('status', { enum: ['running', 'ok', 'failed'] })
    .notNull()
    .default('running'),
  counts: jsonb('counts').$type<Record<string, number>>(),
  error: text('error'),
});

// ---- Public directory (materialized view, migrations/0003_channel_directory.sql) ----

// The only thing public endpoints read: every channel except NSFW, blocklisted, and hidden/removed by a
// curator, with a status. 'live' = a web-playable stream scoring >= 50. Refreshed by the worker.
export const channelStatus = ['live', 'offline', 'no_stream', 'closed'] as const;
export const publicChannels = pgMaterializedView('public_channels', {
  id: text('id').notNull(),
  name: text('name').notNull(),
  altNames: text('alt_names').array().notNull(),
  network: text('network'),
  countryCode: text('country_code').notNull(),
  categories: text('categories').array().notNull(),
  website: text('website'),
  sortName: text('sort_name').notNull(),
  languages: text('languages').array().notNull(),
  logoUrl: text('logo_url'),
  bestStreamId: uuid('best_stream_id'),
  bestScore: smallint('best_score'),
  bestHeight: integer('best_height'),
  bestQuality: text('best_quality'),
  status: text('status', { enum: channelStatus }).notNull(),
  statusRank: smallint('status_rank').notNull(),
}).existing();
