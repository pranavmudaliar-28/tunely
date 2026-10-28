import { Redis } from 'ioredis';

export function createRedis(url = process.env.REDIS_URL ?? 'redis://localhost:6379') {
  // BullMQ requires maxRetriesPerRequest: null on worker connections.
  // family: 0 lets ioredis use IPv6 too (Railway's private network is IPv6-only).
  return new Redis(url, { maxRetriesPerRequest: null, family: 0 });
}
