import {
  API_DATA_VERSION,
  ChannelListSchema,
  ChannelSchema,
  FacetListSchema,
  TrendingSchema,
  type Channel,
  type ChannelList,
  type ChannelStatus,
  type Facet,
  type PlaybackReport,
  type Trending,
} from '@tunely/shared';
import type { z } from 'zod';

// Server components can reach the API on an internal URL; the browser always uses the public one.
const API_URL =
  (typeof window === 'undefined' ? process.env.API_URL : undefined) ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000';

/** Revalidation window for server-rendered catalog pages (seconds). */
export const CATALOG_REVALIDATE = 1800;

export class ApiError extends Error {
  constructor(public status: number) {
    super(`API ${status}`);
  }
}

async function getJson<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: RequestInit & { next?: { revalidate?: number } },
) {
  // The version is part of the URL so Next's data cache drops entries from before an API change.
  const versioned = `${path}${path.includes('?') ? '&' : '?'}v=${API_DATA_VERSION}`;
  const res = await fetch(`${API_URL}${versioned}`, init);
  if (!res.ok) throw new ApiError(res.status);
  return schema.parse(await res.json()) as z.infer<S>;
}

export interface ChannelFilters {
  country?: string;
  category?: string;
  language?: string;
  q?: string;
  /** 'live' = playable now; omit for the full directory */
  status?: ChannelStatus;
  /** 'best': highest health score and resolution first */
  sort?: 'name' | 'best';
  cursor?: string;
  limit?: number;
}

export function channelsPath(f: ChannelFilters) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== '') params.set(k, String(v));
  const qs = params.toString();
  return `/v1/channels${qs ? `?${qs}` : ''}`;
}

const isr = { next: { revalidate: CATALOG_REVALIDATE } };

export const api = {
  channels: (f: ChannelFilters = {}, init = isr): Promise<ChannelList> =>
    getJson(channelsPath(f), ChannelListSchema, init),
  channel: (id: string, init = { next: { revalidate: 300 } }): Promise<Channel> =>
    getJson(`/v1/channels/${encodeURIComponent(id)}`, ChannelSchema, init),
  related: (id: string, init = isr): Promise<ChannelList> =>
    getJson(`/v1/channels/${encodeURIComponent(id)}/related`, ChannelListSchema, init),
  countries: (init = isr): Promise<Facet[]> =>
    getJson('/v1/countries', FacetListSchema, init).then((r) => r.items),
  categories: (init = isr): Promise<Facet[]> =>
    getJson('/v1/categories', FacetListSchema, init).then((r) => r.items),
  languages: (init = isr): Promise<Facet[]> =>
    getJson('/v1/languages', FacetListSchema, init).then((r) => r.items),
  trending: (init = { next: { revalidate: 300 } }): Promise<Trending['items']> =>
    getJson('/v1/trending', TrendingSchema, init).then((r) => r.items),
};

/** Fire-and-forget; keepalive lets it finish while the page navigates away. */
export function sendPlaybackReport(report: PlaybackReport) {
  void fetch(`${API_URL}/v1/playback-reports`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(report),
    keepalive: true,
  }).catch(() => {});
}
