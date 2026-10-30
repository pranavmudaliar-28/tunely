import {
  API_DATA_VERSION,
  ChannelListSchema,
  ChannelSchema,
  FacetListSchema,
  FacetsSchema,
  TrendingSchema,
  type Channel,
  type ChannelList,
  type ChannelStatus,
  type Facet,
  type Facets,
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
/** Channel lists change as streams are checked; keep them fresh (the API also caches for 5 min). */
export const LIST_REVALIDATE = 300;

export class ApiError extends Error {
  constructor(public status: number) {
    super(`API ${status}`);
  }
}

// Server renders all come from a few Vercel IPs, so they carry a key that exempts them from the API's per-IP limit.
// Server-only variable (no NEXT_PUBLIC_ prefix), so it never reaches the browser.
const INTERNAL_API_KEY = typeof window === 'undefined' ? process.env.INTERNAL_API_KEY?.trim() : undefined;

async function getJson<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: RequestInit & { next?: { revalidate?: number } },
) {
  // The version is part of the URL so Next's data cache drops entries from before an API change.
  const versioned = `${path}${path.includes('?') ? '&' : '?'}v=${API_DATA_VERSION}`;
  const res = await fetch(
    `${API_URL}${versioned}`,
    INTERNAL_API_KEY ? { ...init, headers: { ...init?.headers, 'x-internal-key': INTERNAL_API_KEY } } : init,
  );
  if (!res.ok) throw new ApiError(res.status);
  return schema.parse(await res.json()) as z.infer<S>;
}

export interface ChannelFilters {
  country?: string;
  category?: string;
  language?: string;
  q?: string;
  /** Comma-separated channel ids, for a curated set. */
  ids?: string;
  /** 'live' = playable now; omit for the full directory */
  status?: ChannelStatus;
  /** 'best': highest health score and resolution first */
  sort?: 'name' | 'best';
  cursor?: string;
  limit?: number;
}

export function channelsPath(f: ChannelFilters, base = '/v1/channels') {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== '') params.set(k, String(v));
  const qs = params.toString();
  return `${base}${qs ? `?${qs}` : ''}`;
}

const isr = { next: { revalidate: CATALOG_REVALIDATE } };

export const api = {
  channels: (
    f: ChannelFilters = {},
    init = { next: { revalidate: LIST_REVALIDATE } },
  ): Promise<ChannelList> => getJson(channelsPath(f), ChannelListSchema, init),
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
  /** Counts for the browse dropdowns under the current filters and search. */
  facets: (
    { country, category, language, status, q }: ChannelFilters,
    init: RequestInit & { next?: { revalidate?: number } } = { next: { revalidate: LIST_REVALIDATE } },
  ): Promise<Facets> =>
    getJson(channelsPath({ country, category, language, status, q }, '/v1/facets'), FacetsSchema, init),
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
