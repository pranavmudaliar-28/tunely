'use client';

import type { PushSubscriptionJson } from '@tunely/shared';
import { API_URL } from './api-client';

// Opt-in web push. Off unless NEXT_PUBLIC_VAPID_PUBLIC_KEY is set; nothing is registered until a viewer asks.

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();

/** iPhone and iPad only allow it in the installed app (Add to Home Screen); there PushManager exists. */
export function pushSupported(): boolean {
  return (
    Boolean(KEY) &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export const pushConfigured = () => Boolean(KEY);

/** base64url → bytes, for the VAPID public key. */
export function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function existing(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** This browser's subscription, asking permission first (call from a click). Null if refused. */
async function subscription(): Promise<PushSubscriptionJson | null> {
  if (!pushSupported()) return null;
  if (Notification.permission === 'default' && (await Notification.requestPermission()) !== 'granted') return null;
  if (Notification.permission !== 'granted') return null;
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY!) }));
  return sub.toJSON() as PushSubscriptionJson;
}

export type PushResult = 'ok' | 'denied' | 'live now' | 'too many' | 'error';

async function ask(path: string, body: Record<string, unknown>): Promise<PushResult> {
  try {
    const sub = await subscription();
    if (!sub) return 'denied';
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscription: sub, ...body }),
    });
    if (res.ok) return 'ok';
    const { error } = (await res.json().catch(() => ({}))) as { error?: string };
    return error === 'live now' || error === 'too many' ? error : 'error';
  } catch {
    return 'error';
  }
}

export const notifyWhenBack = (channelId: string) => ask('/v1/push/follow', { channelId });
export const notifyBefore = (channelId: string, start: string) => ask('/v1/push/remind', { channelId, start });

/** Whether this browser has notifications on (for Settings). */
export async function pushIsOn(): Promise<boolean> {
  return pushSupported() && Notification.permission === 'granted' && Boolean(await existing().catch(() => null));
}

/** Turn notifications off here: the browser forgets the subscription, and we forget it and what it asked for. */
export async function pushOff(): Promise<void> {
  const sub = await existing();
  if (!sub) return;
  await fetch(`${API_URL}/v1/push/unsubscribe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe();
}
