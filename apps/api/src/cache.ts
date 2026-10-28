import { API_DATA_VERSION } from '@tunely/shared';
import type { FastifyReply } from 'fastify';
import type { Redis } from 'ioredis';

export const CACHE_TTL_S = 300;

export const PUBLIC_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600';

/** Stable cache key: path plus sorted query, so ?a=1&b=2 and ?b=2&a=1 share an entry. */
export function cacheKey(url: string): string {
  const u = new URL(url, 'http://x');
  u.searchParams.sort();
  u.searchParams.delete('v'); // the web's cache-busting param; the version is already in the key
  return `api:${API_DATA_VERSION}:${u.pathname}?${u.searchParams.toString()}`;
}

/** Serve from Redis when present, else compute and store for 5 min. Redis failures fall through to compute. */
export async function cached<T>(
  redis: Redis,
  key: string,
  reply: FastifyReply,
  compute: () => Promise<T>,
): Promise<T> {
  reply.header('cache-control', PUBLIC_CACHE_CONTROL);
  const hit = await redis.get(key).catch(() => null);
  if (hit) {
    reply.header('x-cache', 'hit');
    return JSON.parse(hit) as T;
  }
  const value = await compute();
  reply.header('x-cache', 'miss');
  await redis.set(key, JSON.stringify(value), 'EX', CACHE_TTL_S).catch(() => {});
  return value;
}
