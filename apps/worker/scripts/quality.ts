// Catalog quality report for live channels: pnpm quality [--logos] [--limit N]
// Flags likely duplicates, categories the name contradicts, missing data and (with --logos) logos that don't load.
import { parseArgs } from 'node:util';
import { sql } from 'drizzle-orm';
import { dbFromEnv } from '../src/db';
import { safeFetch } from '../src/net/safe-fetch';
import {
  duplicateGroups,
  missingData,
  missingImpliedCategories,
  type QualityChannel,
} from '../src/quality/checks';

const { values } = parseArgs({ options: { logos: { type: 'boolean' }, limit: { type: 'string' } } });
const limit = Math.max(1, Number(values.limit ?? 30) || 30);
const { db, pool } = dbFromEnv();
const { rows } = await db.execute<QualityChannel>(sql`
  select id, name, country_code as country, categories, languages, logo_url as logo, best_score as score
  from public_channels where status = 'live' order by id`);
await pool.end();

function section(title: string, lines: string[], hint?: string) {
  console.log(`\n${title}: ${lines.length}`);
  for (const l of lines.slice(0, limit)) console.log(`  ${l}`);
  if (lines.length > limit) console.log(`  … ${lines.length - limit} more (--limit ${lines.length})`);
  if (hint && lines.length) console.log(`  → ${hint}`);
}

console.log(`${rows.length} live channels`);
const dupes = duplicateGroups(rows);
section(
  'Likely duplicates (same country, same name but for HD/TV)',
  dupes.map(
    (g) =>
      `${g[0]!.country}  ${g.map((c) => `${c.name} [${c.id}, score ${c.score ?? '–'}]`).join('  |  ')}` +
      `  → keep ${g[0]!.id}: curate hide ${g.slice(1).map((c) => `--id ${c.id}`).join(' ')}`,
  ),
  'run the suggested `pnpm --filter @tunely/worker curate hide ...` after checking they are the same channel',
);
section(
  'Name suggests a missing category',
  rows.flatMap((c) => {
    const miss = missingImpliedCategories(c);
    return miss.length ? [`${c.name} [${c.id}]: has ${c.categories.join(', ') || 'none'}, name says ${miss.join(', ')}`] : [];
  }),
  'categories come from iptv-org: fix them upstream (github.com/iptv-org/database)',
);
section(
  'Missing data',
  rows.flatMap((c) => {
    const miss = missingData(c);
    return miss.length ? [`${c.name} [${c.id}]: no ${miss.join(', no ')}`] : [];
  }),
  'fix upstream in iptv-org/database',
);

if (values.logos) {
  const withLogo = rows.filter((c) => c.logo);
  const broken: string[] = [];
  let next = 0;
  // 8 at a time; only the first KB of each image is read.
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (next < withLogo.length) {
        const c = withLogo[next++]!;
        try {
          const res = await safeFetch(c.logo!, {
            // Wikimedia (most logos) refuses requests without a descriptive User-Agent; browsers always send one.
            headers: { 'user-agent': 'TunelyQualityCheck/1.0 (https://tunely-tv.vercel.app/about)' },
            maxBytes: 5 * 1024 * 1024,
            readBytes: 1024,
            signal: AbortSignal.timeout(10_000),
          });
          const type = res.headers['content-type'] ?? '';
          if (res.status !== 200 || !/^image\//.test(type))
            broken.push(`${c.name} [${c.id}]: HTTP ${res.status} ${type}`.trim());
        } catch (err) {
          broken.push(`${c.name} [${c.id}]: ${String(err).slice(0, 80)}`);
        }
      }
    }),
  );
  section('Logos that do not load', broken.sort(), 'cards show initials instead; fix the logo upstream');
}
