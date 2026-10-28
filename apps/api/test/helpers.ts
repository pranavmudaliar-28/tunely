import { createDb, type Db } from '@tunely/db';
import { Redis } from 'ioredis';
import { buildApp, type Deps } from '../src/app';

// Tests use Redis db 15 so they never touch dev cache or queues.
export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  db: 15,
  lazyConnect: true,
});

export function testApp(overrides: Partial<Deps> = {}) {
  const added: { name: string }[] = [];
  const deps: Deps = {
    db: {} as Db,
    redis,
    queues: { catalog: { add: async (name: string) => (added.push({ name }), { id: '1' }) } as never },
    adminToken: 'test-admin-token',
    reportHashSecret: 'test-secret',
    ...overrides,
  };
  return { app: buildApp(deps), added };
}

export const testDbUrl = process.env.TEST_DATABASE_URL;
export const testDb = () => createDb(testDbUrl ?? '');
