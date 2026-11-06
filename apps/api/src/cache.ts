import { API_DATA_VERSION } from '@tunely/shared';
import type { FastifyReply } from 'fastify';
import type { Redis, RedisOptions } from 'ioredis';

// No offline queue: in a Redis outage, commands must fail at once so requests fall through to Postgres.
// family: 0 lets ioredis use IPv6 too (Railway's private network is IPv6-only).
export const REDIS_OPTIONS: RedisOptions = {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  family: 0,
};

export const CACHE_TTL_S = 300;

export const PUBLIC_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600';

/**
 * Cache key from the route and its validated values, never the raw URL: unknown parameters (and the web's `v`
 * cache-buster) must not mint new entries in the Redis the job queue shares. Sorted, so order doesn't matter.
 */
export function cacheKey(route: string, values: object = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(values).sort(([a], [b]) => (a < b ? -1 : 1)))
    if (v !== undefined) params.set(k, String(v));
  return `api:${API_DATA_VERSION}:${route}?${params}`;
}

/** Drop every cached response (after a takedown). Returns false when Redis can't be reached. */
export async function clearCache(redis: Redis): Promise<boolean> {
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', 'api:*', 'COUNT', 500);
      if (keys.length) await redis.del(...keys);
      cursor = next;
    } while (cursor !== '0');
    return true;
  } catch {
    return false;
  }
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
