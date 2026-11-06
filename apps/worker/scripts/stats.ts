// The last 14 days of playback totals: pnpm stats (from the repo root) [--days N]
import { parseArgs } from 'node:util';
import { sql } from 'drizzle-orm';
import { dbFromEnv } from '../src/db';
import { returningShare } from '../src/jobs/stats';

const { values } = parseArgs({ options: { days: { type: 'string' } } });
const days = Math.min(365, Math.max(1, Number(values.days ?? 14) || 14));
const { db, pool } = dbFromEnv();
const { rows } = await db.execute<{
  day: string;
  platform: string;
  sessions: number;
  attempts: number;
  ok: number;
  errors: Record<string, number>;
  visitors: Record<string, number>;
  ttff_p50: number | null;
  ttff_p90: number | null;
}>(sql`select * from daily_stats where day > current_date - ${days}::int order by day desc, platform`);
await pool.end();

const pct = (x: number | null) => (x === null ? '–' : `${Math.round(x * 100)}%`);
const sec = (ms: number | null) => (ms === null ? '–' : `${(ms / 1000).toFixed(1)} s`);
if (!rows.length) console.log('No daily stats yet: the first row appears the day after reports start.');
else
  console.table(
    rows.map((r) => ({
      day: String(r.day).slice(0, 10),
      platform: r.platform,
      sessions: r.sessions,
      plays: r.attempts,
      'played ok': pct(r.attempts ? r.ok / r.attempts : null),
      'start p50': sec(r.ttff_p50),
      'start p90': sec(r.ttff_p90),
      returning: pct(returningShare(r.visitors)),
      'top error': Object.entries(r.errors).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '–',
    })),
  );
