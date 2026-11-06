import { createDb, schema } from '@tunely/db';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { writeProgrammes } from '../src/jobs/guide';

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('writeProgrammes', () => {
  const { db, pool } = createDb(url ?? '');
  const hour = 3600_000;
  const at = (h: number) => new Date(Date.now() + h * hour);
  const p = (channelId: string, startH: number, title: string) => ({
    channelId,
    start: at(startH),
    stop: at(startH + 1),
    title,
    description: null,
  });

  beforeAll(async () => {
    await db.execute(sql`truncate programmes`);
  });
  afterAll(async () => {
    await pool.end();
  });

  test("replaces a channel's programmes, keeps others, and drops ended ones", async () => {
    await writeProgrammes(db, ['A', 'B'], [p('A', 0, 'Old A'), p('B', 0, 'B now'), p('B', -5, 'B ended')]);
    await writeProgrammes(db, ['A'], [p('A', 0, 'New A'), p('A', 1, 'A next')]);
    const rows = await db
      .select({ channelId: schema.programmes.channelId, title: schema.programmes.title })
      .from(schema.programmes)
      .orderBy(schema.programmes.channelId, schema.programmes.start);
    expect(rows).toEqual([
      { channelId: 'A', title: 'New A' },
      { channelId: 'A', title: 'A next' },
      { channelId: 'B', title: 'B now' },
    ]);
  });
});
