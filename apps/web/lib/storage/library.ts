'use client';

import type { ChannelSummary } from '@tunely/shared';
import { createStore, get, set, type UseStore } from 'idb-keyval';
import { useSyncExternalStore } from 'react';

// Guest favorites and history live in this browser only (IndexedDB). We keep a snapshot of each
// channel so the lists render without an API call.

export interface HistoryEntry {
  channel: ChannelSummary;
  lastWatchedAt: number;
  watchSeconds: number;
}

interface Library {
  favorites: ChannelSummary[];
  history: HistoryEntry[];
}

export const HISTORY_LIMIT = 100;

/** Only the card fields: a full Channel (with stream URLs) never lands in storage. */
const snapshot = ({
  id,
  name,
  country,
  categories,
  languages,
  logo,
  quality,
  status,
}: ChannelSummary): ChannelSummary => ({
  id,
  name,
  country,
  categories,
  languages,
  logo,
  quality,
  status,
});
const EMPTY: Library = { favorites: [], history: [] };

let idb: UseStore | null = null;
const store = () => (idb ??= createStore('tunely', 'library'));

let state: Library = EMPTY;
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(next: Library) {
  state = next;
  listeners.forEach((l) => l());
}

export function loadLibrary(): Promise<void> {
  loaded ??= (async () => {
    try {
      const [favorites, history] = await Promise.all([get('favorites', store()), get('history', store())]);
      emit({ favorites: favorites ?? [], history: history ?? [] });
    } catch {
      // Private mode or blocked storage: the app still works, lists just stay empty.
    }
  })();
  return loaded;
}

async function persist(key: keyof Library, value: Library[keyof Library]) {
  emit({ ...state, [key]: value });
  try {
    await set(key, value, store());
  } catch {
    // See loadLibrary.
  }
}

export async function toggleFavorite(channel: ChannelSummary) {
  await loadLibrary();
  const exists = state.favorites.some((c) => c.id === channel.id);
  await persist(
    'favorites',
    exists ? state.favorites.filter((c) => c.id !== channel.id) : [snapshot(channel), ...state.favorites],
  );
}

/** Record a watch; `seconds` is added to the running total. Keeps the newest HISTORY_LIMIT entries. */
export async function recordWatch(channel: ChannelSummary, seconds = 0, now = Date.now()) {
  await loadLibrary();
  const prev = state.history.find((h) => h.channel.id === channel.id);
  const entry: HistoryEntry = {
    channel: snapshot(channel),
    lastWatchedAt: now,
    watchSeconds: (prev?.watchSeconds ?? 0) + Math.round(seconds),
  };
  await persist(
    'history',
    [entry, ...state.history.filter((h) => h.channel.id !== channel.id)].slice(0, HISTORY_LIMIT),
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void loadLibrary();
  return () => listeners.delete(listener);
}

export function useLibrary(): Library {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );
}

export function useIsFavorite(id: string): boolean {
  return useLibrary().favorites.some((c) => c.id === id);
}

/** Test helper. */
export function __resetLibrary() {
  loaded = null;
  idb = null;
  state = EMPTY;
}
