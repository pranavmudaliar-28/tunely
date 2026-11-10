import { sql } from '@tunely/db/client';
import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { SYNC_MAX_BYTES, SyncDocSchema } from '@/lib/storage/sync-schema';

// A signed-in viewer's own library. The version (when it was last saved, to the millisecond) stops two devices from
// overwriting each other: a save based on an older version gets 409 and the browser merges first.

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

async function viewer(req: Request) {
  const a = getAuth();
  const session = a ? await a.auth.api.getSession({ headers: req.headers }) : null;
  return a && session ? { db: a.db, userId: session.user.id } : null;
}

export async function GET(req: Request) {
  const v = await viewer(req);
  if (!v) return json({ error: 'signed out' }, 401);
  const { rows } = await v.db.execute<{ data: unknown; version: string }>(sql`
    select data, to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as version
    from user_library where user_id = ${v.userId}`);
  return json({ data: rows[0]?.data ?? null, version: rows[0]?.version ?? null });
}

const PutSchema = z.object({ data: SyncDocSchema, base: z.string().max(40).nullable() });

export async function PUT(req: Request) {
  const v = await viewer(req);
  if (!v) return json({ error: 'signed out' }, 401);
  const text = await req.text();
  if (text.length > SYNC_MAX_BYTES) return json({ error: 'too large' }, 413);
  let body: z.infer<typeof PutSchema>;
  try {
    body = PutSchema.parse(JSON.parse(text));
  } catch {
    return json({ error: 'invalid' }, 400);
  }
  const { rows } = await v.db.execute<{ version: string }>(sql`
    insert into user_library (user_id, data, updated_at)
    values (${v.userId}, ${JSON.stringify(body.data)}::jsonb, date_trunc('milliseconds', clock_timestamp()))
    on conflict (user_id) do update set data = excluded.data, updated_at = excluded.updated_at
      where to_char(user_library.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') = ${body.base}
    returning to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as version`);
  return rows[0] ? json({ version: rows[0].version }) : json({ error: 'changed elsewhere' }, 409);
}
