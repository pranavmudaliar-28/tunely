'use client';

import type { Channel, ChannelSummary } from '@tunely/shared';
import { create } from 'zustand';

// The player lives in the root layout so it survives navigation: picture-in-picture and the mini
// player keep playing on every page. The watch page tells it what to play and where to sit.

export interface NowPlaying {
  channel: Channel;
  fallbackLineup: ChannelSummary[];
  meta: string;
}

interface NowPlayingState {
  now: NowPlaying | null;
  /** The watch page's player box. Null on every other page, where the player docks as a mini player. */
  slot: HTMLElement | null;
  play(now: NowPlaying): void;
  setSlot(slot: HTMLElement | null): void;
  close(): void;
}

export const useNowPlaying = create<NowPlayingState>()((set) => ({
  now: null,
  slot: null,
  play: (now) => set({ now }),
  setSlot: (slot) => set({ slot }),
  close: () => set({ now: null }),
}));
