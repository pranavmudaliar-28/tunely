import type { Db } from '@tunely/db';
import { isPushEndpoint, PUSH_REMINDERS_KEY } from '@tunely/shared';
import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import webpush from 'web-push';

// Opt-in web push: "your channel is back" and programme reminders. Off unless the VAPID keys are set.

export interface PushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export function pushConfig(env = process.env): PushConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const subject = env.VAPID_SUBJECT?.trim();
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

type Sub = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** What the service worker shows. `url` is a path on our site. */
export interface Notice {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** Send one notice. A subscription the push service says is gone (404/410), or an odd endpoint, is deleted. */
export async function sendNotice(db: Db, cfg: PushConfig, sub: Sub, notice: Notice): Promise<boolean> {
  // Checked again here: the endpoint is the one value in this request that a browser chose.
  if (!isPushEndpoint(sub.endpoint)) {
    await db.execute(sql`delete from push_subscriptions where id = ${sub.id}`);
    return false;
  }
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(notice),
      { TTL: 3600, timeout: 10_000, vapidDetails: cfg },
    );
    return true;
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) await db.execute(sql`delete from push_subscriptions where id = ${sub.id}`);
    return false;
  }
}

/** "Bloomberg TV is back" or "3 channels you follow are back: A, B and C". */
export function backOnlineNotice(channels: { id: string; name: string }[]): Notice {
  const [first] = channels;
  const url = `/watch/${encodeURIComponent(first!.id)}`;
  if (channels.length === 1)
    return { title: `${first!.name} is back`, body: 'It plays again on Tunely. Tap to watch.', url, tag: 'back-online' };
  const names = channels.slice(0, 3).map((c) => c.name);
  const more = channels.length - names.length;
  const list = more ? `${names.join(', ')} and ${more} more` : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return { title: `${channels.length} channels you follow are back`, body: list, url, tag: 'back-online' };
}

/**
 * After the directory is refreshed: followed channels that are live again, one notice per browser (at most one a
 * day; the rest wait). A sent follow is deleted: "tell me when it's back" is a one-time request.
 */
export async function notifyBackOnline(db: Db, cfg: PushConfig): Promise<number> {
  const { rows } = await db.execute<Sub & { channel_id: string; name: string }>(sql`
    select s.id, s.endpoint, s.p256dh, s.auth, f.channel_id, p.name
    from push_follows f
    join public_channels p on p.id = f.channel_id and p.status = 'live'
    join push_subscriptions s on s.id = f.subscription_id
    where s.last_notified_at is null or s.last_notified_at < now() - interval '1 day'
    order by s.id, p.name`);
  const bySub = new Map<string, { sub: Sub; channels: { id: string; name: string }[] }>();
  for (const r of rows) {
    const entry = bySub.get(r.id) ?? { sub: r, channels: [] };
    entry.channels.push({ id: r.channel_id, name: r.name });
    bySub.set(r.id, entry);
  }
  let sent = 0;
  for (const { sub, channels } of bySub.values()) {
    if (!(await sendNotice(db, cfg, sub, backOnlineNotice(channels)))) continue; // a passing failure: next refresh
    sent++;
    await db.execute(sql`delete from push_follows where subscription_id = ${sub.id}
      and channel_id in (select jsonb_array_elements_text(${JSON.stringify(channels.map((c) => c.id))}::jsonb))`);
    await db.execute(sql`update push_subscriptions set last_notified_at = now() where id = ${sub.id}`);
  }
  return sent;
}

const UUID = /^[0-9a-f-]{36}$/;
/** A worker that was down past the start doesn't send a reminder for a programme long under way. */
const TOO_LATE_MS = 10 * 60_000;

/** Reminders whose time has come (a Redis sorted set, so waiting costs no database query). */
export async function sendDueReminders(db: Db, redis: Redis, cfg: PushConfig, now = Date.now()): Promise<number> {
  const due = await redis.zrangebyscore(PUSH_REMINDERS_KEY, '-inf', now, 'LIMIT', 0, 100);
  let sent = 0;
  for (const member of due) {
    if (!(await redis.zrem(PUSH_REMINDERS_KEY, member))) continue; // taken by another run
    const [subId = '', channelId = '', start = ''] = member.split('|');
    if (!UUID.test(subId) || Number.isNaN(Date.parse(start))) continue;
    const { rows } = await db.execute<Sub & { title: string; name: string | null }>(sql`
      delete from push_reminders r using push_subscriptions s
      where r.subscription_id = ${subId} and r.channel_id = ${channelId} and r.start = ${start}::timestamptz
        and s.id = r.subscription_id
      returning s.id, s.endpoint, s.p256dh, s.auth, r.title,
        (select name from public_channels where id = r.channel_id) as name`);
    const r = rows[0];
    if (!r || Date.parse(start) < now - TOO_LATE_MS) continue;
    const ok = await sendNotice(db, cfg, r, {
      title: `Starting soon: ${r.title}`,
      body: `${r.name ?? channelId} · tap to watch`,
      url: `/watch/${encodeURIComponent(channelId)}`,
      tag: member,
    });
    if (ok) sent++;
  }
  return sent;
}

/** On start-up: Redis may have lost the queue (the free plan doesn't persist), the database hasn't. */
export async function reseedReminders(db: Db, redis: Redis, leadMs: number): Promise<number> {
  await db.execute(sql`delete from push_reminders where start < now() - interval '1 hour'`);
  const { rows } = await db.execute<{ subscription_id: string; channel_id: string; start: Date | string }>(
    sql`select subscription_id, channel_id, start from push_reminders where start > now()`,
  );
  if (!rows.length) return 0;
  const args = rows.flatMap((r) => {
    const at = new Date(r.start);
    return [Math.max(Date.now(), at.getTime() - leadMs), `${r.subscription_id}|${r.channel_id}|${at.toISOString()}`];
  });
  await redis.zadd(PUSH_REMINDERS_KEY, ...args);
  return rows.length;
}
