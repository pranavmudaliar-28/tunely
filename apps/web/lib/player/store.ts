'use client';

import type { ChannelSummary } from '@tunely/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlayerPrefs {
  muted: boolean;
  volume: number;
  /** The list the viewer opened a channel from; channel up/down walks it. */
  lineup: Pick<ChannelSummary, 'id' | 'name'>[];
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  setLineup(lineup: Pick<ChannelSummary, 'id' | 'name'>[]): void;
}

export const usePlayerStore = create<PlayerPrefs>()(
  persist(
    (set) => ({
      muted: false,
      volume: 0.8,
      lineup: [],
      setMuted: (muted) => set({ muted }),
      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)), muted: volume === 0 }),
      setLineup: (lineup) => set({ lineup: lineup.map(({ id, name }) => ({ id, name })) }),
    }),
    // sessionStorage: the lineup only makes sense for this visit; volume carries over within it.
    {
      name: 'tunely.player',
      storage: {
        getItem: (k) => readSession(k),
        setItem: (k, v) => writeSession(k, v),
        removeItem: () => {},
      },
    },
  ),
);

function readSession(key: string) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeSession(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: prefs just don't persist.
  }
}

/** Neighbour in the lineup, wrapping around. Null when the channel isn't in it. */
export function neighbour(lineup: { id: string }[], currentId: string, step: 1 | -1): string | null {
  const i = lineup.findIndex((c) => c.id === currentId);
  if (i === -1 || lineup.length < 2) return null;
  return lineup[(i + step + lineup.length) % lineup.length]!.id;
}
