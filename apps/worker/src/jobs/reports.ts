import type { Db } from '@tunely/db';
import { REPORTS_BUFFER } from '@tunely/shared';
import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';

const BATCH = 1000;
const MAX_BATCHES = 20;

/**
 * Move buffered playback reports from Redis into Postgres. Reports for unknown streams are dropped.
 * Returns how many were stored and which streams they were for.
 */
export async function flushReports(db: Db, redis: Redis): Promise<{ inserted: number; streamIds: string[] }> {
  let inserted = 0;
  const streamIds = new Set<string>();
  for (let i = 0; i < MAX_BATCHES; i++) {
    const raw = await redis.lpop(REPORTS_BUFFER, BATCH);
    if (!raw?.length) break;
    const rows = raw.flatMap((r) => {
      try {
        return [JSON.parse(r) as unknown];
      } catch {
        return [];
      }
    });
    const res = await db.execute<{ stream_id: string }>(sql`
      insert into playback_reports (stream_id, platform, result, error_type, ttff_ms, anon_session_hash, created_at)
      select v."streamId", v.platform, v.result, v."errorType", v."ttffMs", v."anonSessionHash", coalesce(v.at, now())
      from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as v(
        "streamId" uuid, platform text, result text, "errorType" text, "ttffMs" int, "anonSessionHash" text, at timestamptz)
      where v.result in ('ok', 'error') and v."anonSessionHash" is not null
        and exists (select 1 from streams s where s.id = v."streamId")
      returning stream_id`);
    inserted += res.rowCount ?? 0;
    for (const r of res.rows) streamIds.add(r.stream_id);
    if (raw.length < BATCH) break;
  }
  return { inserted, streamIds: [...streamIds] };
}
