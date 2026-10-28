import { z } from 'zod';

// Row schemas for https://iptv-org.github.io/api/*.json. Everything from there is untrusted:
// rows that fail these schemas are skipped and counted by the sync job.

const id = z.string().trim().min(1).max(200);
const str = z.string().trim().max(500);
const strArr = z.array(z.string().trim().min(1).max(100)).max(500).catch([]);
const optStr = str.nullish().transform((v) => v || null);

const PRIVATE_HOST =
  /^(localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[?::1?\]?|\[?f[cd][0-9a-f]{2}:.*|\[?fe80:.*)$/i;

/** http(s) URL whose host is not a literal private/loopback address. DNS-level checks happen at fetch time. */
export function isPublicHttpUrl(value: string): boolean {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (u.username || u.password) return false;
  return !PRIVATE_HOST.test(u.hostname);
}

const publicUrl = z.string().trim().max(2000).refine(isPublicHttpUrl, 'not a public http(s) url');
const optWebsite = z
  .string()
  .nullish()
  .transform((v) => (v && isPublicHttpUrl(v) ? v : null));

export const IptvChannel = z.object({
  id,
  name: str.min(1),
  alt_names: strArr.optional().default([]),
  network: optStr,
  country: z.string().trim().length(2),
  categories: strArr.optional().default([]),
  is_nsfw: z.boolean().catch(false),
  launched: optStr,
  closed: optStr,
  replaced_by: optStr,
  website: optWebsite,
});

export const IptvFeed = z.object({
  channel: id,
  id,
  name: str.min(1),
  is_main: z.boolean().catch(false),
  broadcast_area: strArr.optional().default([]),
  timezones: strArr.optional().default([]),
  languages: strArr.optional().default([]),
  format: optStr,
});

export const IptvStream = z.object({
  channel: id,
  feed: optStr,
  title: str.min(1),
  url: publicUrl,
  referrer: optStr,
  user_agent: optStr,
  quality: optStr,
  // Older dumps used `label`, newer ones may use `labels`.
  label: optStr,
  labels: strArr.optional(),
});

export const IptvLogo = z.object({
  channel: id,
  feed: optStr,
  width: z.number().int().nonnegative().nullish(),
  height: z.number().int().nonnegative().nullish(),
  format: optStr,
  in_use: z.boolean().catch(true).default(true),
  url: publicUrl,
});

export const IptvCategory = z.object({ id, name: str.min(1), description: optStr });
export const IptvCountry = z.object({
  code: z.string().trim().length(2),
  name: str.min(1),
  flag: optStr,
  languages: strArr.optional().default([]),
});
export const IptvLanguage = z.object({ code: z.string().trim().min(2).max(3), name: str.min(1) });
export const IptvBlocklist = z.object({ channel: id, reason: optStr, ref: optStr });

export type IptvChannel = z.infer<typeof IptvChannel>;
export type IptvFeed = z.infer<typeof IptvFeed>;
export type IptvStream = z.infer<typeof IptvStream>;
export type IptvLogo = z.infer<typeof IptvLogo>;
export type IptvCategory = z.infer<typeof IptvCategory>;
export type IptvCountry = z.infer<typeof IptvCountry>;
export type IptvLanguage = z.infer<typeof IptvLanguage>;
export type IptvBlocklist = z.infer<typeof IptvBlocklist>;

export const IPTV_FILES = {
  channels: IptvChannel,
  feeds: IptvFeed,
  streams: IptvStream,
  logos: IptvLogo,
  categories: IptvCategory,
  countries: IptvCountry,
  languages: IptvLanguage,
  blocklist: IptvBlocklist,
} as const;
export type IptvFileName = keyof typeof IPTV_FILES;

/** Validate each row, keeping the valid ones and counting the rest. */
export function parseRows<S extends z.ZodType>(
  schema: S,
  rows: unknown,
): { valid: z.infer<S>[]; invalid: number } {
  if (!Array.isArray(rows)) return { valid: [], invalid: 0 };
  const valid: z.infer<S>[] = [];
  let invalid = 0;
  for (const row of rows) {
    const r = schema.safeParse(row);
    if (r.success) valid.push(r.data);
    else invalid++;
  }
  return { valid, invalid };
}
