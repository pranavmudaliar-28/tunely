'use client';

import { useSyncExternalStore } from 'react';

export interface Slot {
  title: string;
  description: string | null;
  start: string;
  stop: string;
}

/** The programme on at `now` and the one after it (either may be missing). */
export function nowAndNext<T extends Pick<Slot, 'start' | 'stop'>>(schedule: T[], now: number): { current?: T; next?: T } {
  const at = (s: string) => Date.parse(s);
  const current = schedule.find((p) => at(p.start) <= now && at(p.stop) > now);
  const next = schedule.find((p) => p !== current && at(p.start) > now);
  return { current, next };
}

/** "23 min left", "1 h 20 min left". */
export function timeLeft(stop: string, now: number): string {
  const m = Math.max(1, Math.round((Date.parse(stop) - now) / 60_000));
  if (m < 60) return `${m} min left`;
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min left` : `${m / 60} h left`;
}

const STEP_MS = 30_000;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  timer ??= setInterval(() => listeners.forEach((l) => l()), STEP_MS);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** The time, to the half minute; null on the server and during hydration (the viewer's clock and time zone differ). */
export function useClock(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / STEP_MS) * STEP_MS,
    () => null,
  );
}
