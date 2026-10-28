import { Redis } from 'ioredis';

export function createRedis(url = process.env.REDIS_URL ?? 'redis://localhost:6379') {
  // BullMQ requires maxRetriesPerRequest: null on worker connections.
  return new Redis(url, { maxRetriesPerRequest: null });
}
