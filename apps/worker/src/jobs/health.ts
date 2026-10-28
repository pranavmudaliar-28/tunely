import { schema, type Db } from '@tunely/db';
import { sql } from 'drizzle-orm';
import { checkStream, isWebPlayable, type CheckResult, type StreamInput } from '../health/check-stream';
import { computeScore } from '../health/score';

export const RECHECK_AFTER_HOURS = 4;
/** After this many consecutive failures a stream stops counting as natively playable. */
const NATIVE_FAIL_STREAK = 3;

type Checker = (s: StreamInput) => Promise<CheckResult>;

export async function ensurePartitions(db: Db) {
  await db.execute(
    sql`select ensure_stream_checks_partition(now()), ensure_stream_checks_partition(now() + interval '1 month')`,
  );
}

/** Check the streams that are due (never checked, or not in the last 4 h), oldest first. */
export async function runHealthBatch(
  db: Db,
  { limit = 1000, concurrency = 40, checker = checkStream as Checker } = {},
): Promise<{ checked: number; ok: number; webPlayable: number }> {
  await ensurePartitions(db);
  const due = await db.execute<{
    id: string;
    url: string;
    referrer: string | null;
    user_agent: string | null;
  }>(sql`
    select s.id, s.url, s.referrer, s.user_agent
    from streams s left join stream_health h on h.stream_id = s.id
    where h.last_checked_at is null or h.last_checked_at < now() - make_interval(hours => ${RECHECK_AFTER_HOURS})
    order by h.last_checked_at nulls first
    limit ${limit}`);

  let ok = 0;
  let web = 0;
  const checkedIds: string[] = [];
  await mapLimit(due.rows, concurrency, async (s) => {
    const r = await checker({ url: s.url, referrer: s.referrer, userAgent: s.user_agent });
    await recordCheck(db, s.id, r);
    checkedIds.push(s.id);
    if (r.ok) ok++;
    if (isWebPlayable(r)) web++;
  });
  await rescore(db, checkedIds);
  return { checked: checkedIds.length, ok, webPlayable: web };
}

export async function recordCheck(db: Db, streamId: string, r: CheckResult) {
  await db.insert(schema.streamChecks).values({ streamId, ...r });
  const now = new Date();
  await db
    .insert(schema.streamHealth)
    .values({
      streamId,
      webPlayable: isWebPlayable(r),
      nativePlayable: r.ok,
      height: r.height,
      lastOkAt: r.ok ? now : null,
      lastCheckedAt: now,
      failStreak: r.ok ? 0 : 1,
    })
    .onConflictDoUpdate({
      target: schema.streamHealth.streamId,
      // On failure keep the last known playability; the score (capped below 50) is what hides it.
      set: r.ok
        ? {
            webPlayable: isWebPlayable(r),
            nativePlayable: true,
            height: sql`coalesce(${r.height}::int, ${schema.streamHealth.height})`,
            lastOkAt: now,
            lastCheckedAt: now,
            failStreak: 0,
            updatedAt: now,
          }
        : {
            failStreak: sql`${schema.streamHealth.failStreak} + 1`,
            nativePlayable: sql`${schema.streamHealth.failStreak} + 1 < ${NATIVE_FAIL_STREAK} and ${schema.streamHealth.nativePlayable}`,
            lastCheckedAt: now,
            updatedAt: now,
          },
    });
}

/** Recompute scores from the last 12 checks and the last 24 h of player reports. All streams when ids is omitted. */
export async function rescore(db: Db, ids?: string[]) {
  if (ids && ids.length === 0) return 0;
  const filter = ids
    ? sql`where h.stream_id in (select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)::uuid)`
    : sql``;
  const rows = await db.execute<{
    stream_id: string;
    checks: { ok: boolean; latencyMs: number | null }[];
    reports_ok: number;
    reports_error: number;
  }>(sql`
    select h.stream_id,
      coalesce((select json_agg(json_build_object('ok', c.ok, 'latencyMs', c.latency_ms) order by c.checked_at desc)
                from (select ok, latency_ms, checked_at from stream_checks
                      where stream_id = h.stream_id and checked_at > now() - interval '30 days'
                      order by checked_at desc limit 12) c), '[]') as checks,
      (select count(*) from playback_reports p where p.stream_id = h.stream_id and p.result = 'ok' and p.created_at > now() - interval '24 hours')::int as reports_ok,
      (select count(*) from playback_reports p where p.stream_id = h.stream_id and p.result = 'error' and p.created_at > now() - interval '24 hours')::int as reports_error
    from stream_health h ${filter}`);

  const scored = rows.rows.map((r) => ({
    id: r.stream_id,
    score: computeScore({ checks: r.checks, reportsOk: r.reports_ok, reportsError: r.reports_error }),
  }));
  for (let i = 0; i < scored.length; i += 2000) {
    const chunk = JSON.stringify(scored.slice(i, i + 2000));
    await db.execute(sql`
      update stream_health h set score = v.score, updated_at = now()
      from jsonb_to_recordset(${chunk}::jsonb) as v(id uuid, score int)
      where h.stream_id = v.id and h.score is distinct from v.score`);
  }
  return scored.length;
}

/** Keep 30 days of checks: delete older rows and drop monthly partitions that are entirely older. */
export async function pruneChecks(db: Db) {
  await db.execute(sql`delete from stream_checks where checked_at < now() - interval '30 days'`);
  const parts = await db.execute<{ name: string }>(sql`
    select c.relname as name from pg_inherits i
    join pg_class c on c.oid = i.inhrelid join pg_class p on p.oid = i.inhparent
    where p.relname = 'stream_checks' and c.relname ~ '^stream_checks_[0-9]{6}$'`);
  const cutoff = new Date(Date.now() - 31 * 24 * 3600 * 1000);
  for (const { name } of parts.rows) {
    const y = Number(name.slice(-6, -2));
    const m = Number(name.slice(-2));
    if (new Date(Date.UTC(y, m, 1)) < cutoff) await db.execute(sql.raw(`drop table if exists "${name}"`));
  }
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const run = async () => {
    while (next < items.length) await fn(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}
