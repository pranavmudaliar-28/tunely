import { z } from 'zod';

// Web push, shared by the web app (subscribes), the API (stores) and the worker (sends).

/**
 * Push services of the browsers we support. The endpoint comes from the client and the worker POSTs to it, so only
 * these hosts are accepted: anything else would let a caller make our server send requests where it likes.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge on Android, Samsung Internet, Opera, Brave
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^web\.push\.apple\.com$/, // Safari
  /^[a-z0-9-]+\.notify\.windows\.com$/, // Edge on Windows
];

export function isPushEndpoint(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !url.port && !url.username && PUSH_HOSTS.some((h) => h.test(url.hostname));
  } catch {
    return false;
  }
}

export const PushSubscriptionSchema = z.object({
  endpoint: z.string().max(1000).refine(isPushEndpoint, 'not a known push service'),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{80,100}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{16,32}$/),
  }),
});
export type PushSubscriptionJson = z.infer<typeof PushSubscriptionSchema>;

const ChannelId = z.string().min(1).max(200);
export const PushFollowSchema = z.object({ subscription: PushSubscriptionSchema, channelId: ChannelId });
export const PushRemindSchema = z.object({
  subscription: PushSubscriptionSchema,
  channelId: ChannelId,
  start: z.iso.datetime({ offset: true }),
});
export const PushUnsubscribeSchema = z.object({ endpoint: z.string().max(1000) });

/** Per browser: enough for real use, not for filling the database. */
export const PUSH_MAX_FOLLOWS = 50;
export const PUSH_MAX_REMINDERS = 50;
/** Sorted set of due reminders: member "subscriptionId|channelId|startISO", score = when to send (ms). */
export const PUSH_REMINDERS_KEY = 'tunely:push:reminders';
export const REMINDER_LEAD_MS = 5 * 60_000;
