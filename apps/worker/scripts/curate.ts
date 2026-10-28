// Set curation status until the admin UI exists (Phase 5).
//   pnpm --filter @tunely/worker curate approve --id DDNews.in --id DWNews.de
//   pnpm --filter @tunely/worker curate approve --country IN --category news
//   pnpm --filter @tunely/worker curate hide --id Foo.us --reason "pay-tv"
import { refreshPublicChannels, schema } from '@tunely/db';
import { curationStatus } from '@tunely/db/schema';
import { and, arrayContains, eq, inArray, type SQL } from 'drizzle-orm';
import { parseArgs } from 'node:util';
import { dbFromEnv } from '../src/db';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    id: { type: 'string', multiple: true },
    country: { type: 'string' },
    category: { type: 'string' },
    reason: { type: 'string' },
  },
});
const VERBS: Record<string, (typeof curationStatus)[number]> = {
  approve: 'approved',
  hide: 'hidden',
  remove: 'removed',
  pending: 'pending',
};
const status = VERBS[positionals[0] ?? ''] ?? (positionals[0] as (typeof curationStatus)[number]);
if (!curationStatus.includes(status))
  throw new Error(`usage: curate <approve|hide|remove|pending> [--id X]... [--country CC] [--category slug]`);

const where: SQL[] = [];
if (values.id?.length) where.push(inArray(schema.channels.id, values.id));
if (values.country) where.push(eq(schema.channels.countryCode, values.country.toUpperCase()));
if (values.category) where.push(arrayContains(schema.channels.categories, [values.category]));
if (!where.length) throw new Error('refusing to curate every channel: pass --id, --country or --category');

const { db, pool } = dbFromEnv();
const ids = (
  await db
    .select({ id: schema.channels.id })
    .from(schema.channels)
    .where(and(...where))
).map((r) => r.id);
if (ids.length) {
  await db
    .update(schema.channelCuration)
    .set({ status, reason: values.reason ?? null, reviewedBy: 'cli', reviewedAt: new Date() })
    .where(inArray(schema.channelCuration.channelId, ids));
}
// Hide/remove must take effect on the site immediately (takedowns).
await refreshPublicChannels(db);
console.log(`${status}: ${ids.length} channel(s)`);
await pool.end();
