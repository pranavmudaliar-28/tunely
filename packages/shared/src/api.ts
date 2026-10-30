import { z } from 'zod';

// Public API shapes shared by the API, the web app and future native apps.

export const StreamSchema = z.object({
  id: z.string(),
  url: z.url(),
  quality: z.string().nullable(),
  score: z.number().int().min(0).max(100),
  webPlayable: z.boolean(),
  nativePlayable: z.boolean(),
  referrer: z.string().nullable(),
  userAgent: z.string().nullable(),
});
export type Stream = z.infer<typeof StreamSchema>;

/** live: plays in the browser now · offline: has streams, none working · no_stream · closed: off air for good */
export const ChannelStatusSchema = z.enum(['live', 'offline', 'no_stream', 'closed']);
export type ChannelStatus = z.infer<typeof ChannelStatusSchema>;

export const ChannelSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),
  categories: z.array(z.string()),
  languages: z.array(z.string()),
  logo: z.string().nullable(),
  quality: z.string().nullable(),
  status: ChannelStatusSchema,
});
export type ChannelSummary = z.infer<typeof ChannelSummarySchema>;

export const ChannelSchema = ChannelSummarySchema.extend({
  website: z.string().nullable(),
  streams: z.array(StreamSchema),
});
export type Channel = z.infer<typeof ChannelSchema>;

export const ChannelListQuerySchema = z.object({
  country: z.string().length(2).toUpperCase().optional(),
  category: z.string().max(40).optional(),
  language: z.string().max(3).optional(),
  q: z.string().trim().min(1).max(80).optional(),
  status: ChannelStatusSchema.optional(),
  /** name: A–Z (default) · best: highest health score and resolution first */
  sort: z.enum(['name', 'best']).default('name'),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(48),
  /** Comma-separated channel ids (up to 50): fetch a curated set in one request. */
  ids: z
    .string()
    .max(2000)
    .regex(/^[\w.@-]+(,[\w.@-]+)*$/)
    .optional(),
});
export type ChannelListQuery = z.infer<typeof ChannelListQuerySchema>;

export const ChannelListSchema = z.object({
  items: z.array(ChannelSummarySchema),
  nextCursor: z.string().nullable(),
});
export type ChannelList = z.infer<typeof ChannelListSchema>;

export const FacetSchema = z.object({
  id: z.string(),
  name: z.string(),
  count: z.number().int(),
  flag: z.string().nullable().optional(),
});
export type Facet = z.infer<typeof FacetSchema>;
export const FacetListSchema = z.object({ items: z.array(FacetSchema) });

/** Filters the browse counts follow (everything a channel list filters by, minus sort and paging). */
export const FacetsQuerySchema = ChannelListQuerySchema.pick({
  country: true,
  category: true,
  language: true,
  status: true,
  q: true,
});
export type FacetsQuery = z.infer<typeof FacetsQuerySchema>;
const FacetCountSchema = z.object({ id: z.string(), count: z.number().int() });
export type FacetCount = z.infer<typeof FacetCountSchema>;
/** Channel counts per option, each counted with every filter except its own; names come from the facet lists. */
export const FacetsSchema = z.object({
  countries: z.array(FacetCountSchema),
  categories: z.array(FacetCountSchema),
  languages: z.array(FacetCountSchema),
  statuses: z.array(FacetCountSchema),
});
export type Facets = z.infer<typeof FacetsSchema>;

export const TrendingSchema = z.object({
  items: z.array(ChannelSummarySchema.extend({ viewers: z.number().int() })),
});
export type Trending = z.infer<typeof TrendingSchema>;

export const PlaybackErrorTypes = [
  'offline',
  'geo_blocked',
  'browser_blocked',
  'unsupported_codec',
  'timeout',
  'media',
  'unknown',
] as const;

export const PlaybackReportSchema = z.object({
  streamId: z.uuid(),
  platform: z.enum(['web', 'android', 'androidtv', 'ios']),
  result: z.enum(['ok', 'error']),
  errorType: z.enum(PlaybackErrorTypes).nullable().default(null),
  ttffMs: z.number().int().min(0).max(120_000).nullable().default(null),
  // Random id the client keeps per browser session; hashed server-side with a daily salt.
  sessionId: z.string().min(8).max(64),
});
export type PlaybackReport = z.infer<typeof PlaybackReportSchema>;

/**
 * Version of the public API's data (response shapes and ordering). Bump it when either changes:
 * the API keys its Redis cache on it and the web app sends it with every request, so both the
 * Redis cache and Next's data cache start fresh instead of serving data in the old form.
 */
export const API_DATA_VERSION = 6;
