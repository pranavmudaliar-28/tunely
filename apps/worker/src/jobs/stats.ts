import type { Db } from '@tunely/db';
import { sql } from 'drizzle-orm';

/** Share of sessions (with a known visitor age) from browsers that had used Tunely on an earlier day; null if none. */
export function returningShare(visitors: Record<string, number>): number | null {
  const n = (k: string) => visitors[k] ?? 0;
  const returning = n('week') + n('month') + n('older');
  const known = returning + n('first_day');
  return known ? returning / known : null;
}

/** The UTC day before `now`, as YYYY-MM-DD. */
export function previousDay(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
    .toISOString()
    .slice(0, 10);
}

/**
 * Roll yesterday's playback reports up into daily_stats, once. Runs from the hourly job before reports older than
 * 2 days are deleted, so yesterday is always complete when it runs. Returns false when the day was already done.
 * shortcut: a day with no reports writes nothing and is re-checked hourly (one cheap query); fine at this size.
 */
export async function rollupDailyStats(db: Db, now = new Date()): Promise<boolean> {
  const day = previousDay(now);
  const done = await db.execute(sql`select 1 from daily_stats where day = ${day}::date limit 1`);
  if (done.rows.length) return false;
  await db.execute(sql`
    with r as (
      select platform, coalesce(visitor_age, 'unknown') as age, result, coalesce(error_type, 'unknown') as error_type,
        ttff_ms, anon_session_hash as s
      from playback_reports
      where created_at >= (${day}::date)::timestamp at time zone 'UTC'
        and created_at < (${day}::date + 1)::timestamp at time zone 'UTC'
    ),
    errs as (
      select platform, jsonb_object_agg(error_type, n) as errors
      from (select platform, error_type, count(*) as n from r where result = 'error' group by 1, 2) x
      group by 1
    ),
    ages as (
      select platform, jsonb_object_agg(age, n) as visitors
      from (select platform, age, count(distinct s) as n from r group by 1, 2) x
      group by 1
    ),
    totals as (
      select platform, count(distinct s)::int as sessions, count(*)::int as attempts,
        (count(*) filter (where result = 'ok'))::int as ok,
        (percentile_cont(0.5) within group (order by ttff_ms) filter (where result = 'ok'))::int as p50,
        (percentile_cont(0.9) within group (order by ttff_ms) filter (where result = 'ok'))::int as p90
      from r
      group by platform
    )
    insert into daily_stats (day, platform, sessions, attempts, ok, errors, visitors, ttff_p50, ttff_p90)
    select ${day}::date, t.platform, t.sessions, t.attempts, t.ok, coalesce(e.errors, '{}'), coalesce(a.visitors, '{}'),
      t.p50, t.p90
    from totals t left join errs e using (platform) left join ages a using (platform)
    on conflict do nothing`);
  return true;
}
