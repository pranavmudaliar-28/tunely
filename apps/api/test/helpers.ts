import type { Db } from '@tunely/db';
import { buildApp, type Deps } from '../src/app';

export function testApp(overrides: Partial<Deps> = {}) {
  const added: { name: string }[] = [];
  const deps: Deps = {
    db: {} as Db,
    queues: { catalog: { add: async (name: string) => (added.push({ name }), { id: '1' }) } as never },
    adminToken: 'test-admin-token',
    ...overrides,
  };
  return { app: buildApp(deps), added };
}
