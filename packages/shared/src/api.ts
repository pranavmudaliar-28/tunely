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
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(48),
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

export const TrendingSchema = z.object({
  items: z.array(ChannelSummarySchema.extend({ viewers: z.number().int() })),
});
export type Trending = z.infer<typeof TrendingSchema>;

export const PlaybackErrorTypes = [
  'offline',
  'geo_blocked',
  'browser_blocked',
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
