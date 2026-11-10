import {
  PUSH_MAX_FOLLOWS,
  PUSH_MAX_REMINDERS,
  PUSH_REMINDERS_KEY,
  PushFollowSchema,
  PushRemindSchema,
  PushUnsubscribeSchema,
  REMINDER_LEAD_MS,
  type PushSubscriptionJson,
} from '@tunely/shared';
import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Deps } from '../app';

const Ok = z.object({ ok: z.literal(true) });
const Err = z.object({ error: z.string() });
const limited = { rateLimit: { max: 20, timeWindow: '1 minute' } };

async function subscriptionId(db: Deps['db'], s: PushSubscriptionJson): Promise<string> {
  const { rows } = await db.execute<{ id: string }>(sql`
    insert into push_subscriptions (endpoint, p256dh, auth) values (${s.endpoint}, ${s.keys.p256dh}, ${s.keys.auth})
    on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth
    returning id`);
  return rows[0]!.id;
}

/** Opt-in web push: a browser's subscription, the offline channels it waits for, and its programme reminders. */
export const pushRoutes =
  (deps: Deps): FastifyPluginAsyncZod =>
  async (app) => {
    const { db, redis } = deps;

    app.post(
      '/v1/push/follow',
      {
        config: limited,
        schema: {
          tags: ['push'],
          summary: 'Notify this browser once an offline channel is live again',
          body: PushFollowSchema,
          response: { 200: Ok, 404: Err, 409: Err },
        },
      },
      async (req, reply) => {
        const { subscription, channelId } = req.body;
        const { rows } = await db.execute<{ status: string }>(
          sql`select status from public_channels where id = ${channelId}`,
        );
        const status = rows[0]?.status;
        if (!status) return reply.code(404).send({ error: 'not found' });
        if (status === 'live') return reply.code(409).send({ error: 'live now' });
        if (status === 'closed') return reply.code(409).send({ error: 'closed' });
        const id = await subscriptionId(db, subscription);
        const { rows: count } = await db.execute<{ n: number }>(
          sql`select count(*)::int as n from push_follows where subscription_id = ${id}`,
        );
        if ((count[0]?.n ?? 0) >= PUSH_MAX_FOLLOWS) return reply.code(409).send({ error: 'too many' });
        await db.execute(sql`insert into push_follows (subscription_id, channel_id) values (${id}, ${channelId})
          on conflict do nothing`);
        return { ok: true as const };
      },
    );

    app.post(
      '/v1/push/remind',
      {
        config: limited,
        schema: {
          tags: ['push'],
          summary: 'Notify this browser 5 minutes before a programme starts',
          body: PushRemindSchema,
          response: { 200: Ok, 404: Err, 409: Err },
        },
      },
      async (req, reply) => {
        const { subscription, channelId, start } = req.body;
        // The title comes from our guide, never from the caller.
        const { rows } = await db.execute<{ title: string; start: Date | string }>(sql`
          select p.title, p.start from programmes p join public_channels c on c.id = p.channel_id
          where p.channel_id = ${channelId} and p.start = ${start}::timestamptz and p.start > now()`);
        const programme = rows[0];
        if (!programme) return reply.code(404).send({ error: 'not found' });
        const id = await subscriptionId(db, subscription);
        const { rows: count } = await db.execute<{ n: number }>(
          sql`select count(*)::int as n from push_reminders where subscription_id = ${id}`,
        );
        if ((count[0]?.n ?? 0) >= PUSH_MAX_REMINDERS) return reply.code(409).send({ error: 'too many' });
        const at = new Date(programme.start);
        await db.execute(sql`insert into push_reminders (subscription_id, channel_id, start, title)
          values (${id}, ${channelId}, ${at.toISOString()}, ${programme.title}) on conflict do nothing`);
        await redis.zadd(
          PUSH_REMINDERS_KEY,
          Math.max(Date.now(), at.getTime() - REMINDER_LEAD_MS),
          `${id}|${channelId}|${at.toISOString()}`,
        );
        return { ok: true as const };
      },
    );

    app.post(
      '/v1/push/unsubscribe',
      {
        config: limited,
        schema: {
          tags: ['push'],
          summary: "Forget this browser's subscription, follows and reminders",
          body: PushUnsubscribeSchema,
          response: { 200: Ok },
        },
      },
      async (req) => {
        await db.execute(sql`delete from push_subscriptions where endpoint = ${req.body.endpoint}`);
        return { ok: true as const };
      },
    );
  };
