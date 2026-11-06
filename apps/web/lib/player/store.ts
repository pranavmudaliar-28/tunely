'use client';

import type { ChannelSummary } from '@tunely/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlayerPrefs {
  muted: boolean;
  volume: number;
  /** Preferred picture height (e.g. 720); null = Auto. Streams differ, so the closest height at or below wins. */
  quality: number | null;
  /** The list the viewer opened a channel from; channel up/down walks it. */
  lineup: Pick<ChannelSummary, 'id' | 'name' | 'status'>[];
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  setQuality(quality: number | null): void;
  setLineup(lineup: Pick<ChannelSummary, 'id' | 'name' | 'status'>[]): void;
}

type Stored = { state: Partial<PlayerPrefs>; version?: number };

export const usePlayerStore = create<PlayerPrefs>()(
  persist(
    (set) => ({
      muted: false,
      volume: 0.8,
      quality: null,
      lineup: [],
      setMuted: (muted) => set({ muted }),
      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)), muted: volume === 0 }),
      setQuality: (quality) => set({ quality }),
      setLineup: (lineup) => set({ lineup: lineup.map(({ id, name, status }) => ({ id, name, status })) }),
    }),
    // Volume, mute and quality are kept between visits (localStorage); the lineup only makes sense for
    // this visit (sessionStorage).
    {
      name: 'tunely.player',
      partialize: ({ muted, volume, quality, lineup }) => ({ muted, volume, quality, lineup }),
      storage: {
        getItem: (k) => {
          const prefs = read(() => localStorage, k);
          const visit = read(() => sessionStorage, k);
          if (!prefs && !visit) return null;
          // Partial is fine: persist merges what it reads over the defaults.
          return { state: { ...visit?.state, ...prefs?.state } as PlayerPrefs, version: 0 };
        },
        setItem: (k, { state, version }) => {
          const { lineup, ...prefs } = state;
          write(() => localStorage, k, { state: prefs, version });
          write(() => sessionStorage, k, { state: { lineup }, version });
        },
        removeItem: () => {},
      },
    },
  ),
);

function read(storage: () => Storage, key: string): Stored | null {
  try {
    const raw = storage().getItem(key);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}
function write(storage: () => Storage, key: string, value: Stored) {
  try {
    storage().setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: prefs just don't persist.
  }
}

/** Index of the best level at or below the preferred height; -1 (Auto) when there is no preference or match. */
export function preferredLevel(levels: { index: number; height: number }[], quality: number | null): number {
  if (!quality) return -1;
  const fit = levels.filter((l) => l.height <= quality).sort((a, b) => b.height - a.height)[0];
  return fit?.index ?? -1;
}

/** Next live channel in the lineup, wrapping around and skipping dead ones. Null when there is none. */
export function neighbour(
  lineup: { id: string; status?: string }[],
  currentId: string,
  step: 1 | -1,
): string | null {
  const i = lineup.findIndex((c) => c.id === currentId);
  if (i === -1) return null;
  for (let k = 1; k < lineup.length; k++) {
    const c = lineup[(i + step * k + lineup.length * k) % lineup.length]!;
    if ((c.status ?? 'live') === 'live') return c.id;
  }
  return null;
}
