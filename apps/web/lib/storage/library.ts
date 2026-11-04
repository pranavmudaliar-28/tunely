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

/** A viewer-named group of favorites. A channel can be in several. */
export interface Folder {
  id: string;
  name: string;
  channelIds: string[];
}

interface Library {
  favorites: ChannelSummary[];
  history: HistoryEntry[];
  folders: Folder[];
}

export const HISTORY_LIMIT = 100;
export const FOLDER_LIMIT = 20;
export const FOLDER_NAME_MAX = 30;

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
const EMPTY: Library = { favorites: [], history: [], folders: [] };

/** Stored data is ours, but it outlives code versions: keep only folders with the expected shape. */
const validFolders = (value: unknown): Folder[] =>
  Array.isArray(value)
    ? value.filter(
        (f): f is Folder =>
          typeof f?.id === 'string' &&
          typeof f?.name === 'string' &&
          Array.isArray(f?.channelIds) &&
          f.channelIds.every((c: unknown) => typeof c === 'string'),
      )
    : [];

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
      const [favorites, history, folders] = await Promise.all([
        get('favorites', store()),
        get('history', store()),
        get('folders', store()),
      ]);
      emit({ favorites: favorites ?? [], history: history ?? [], folders: validFolders(folders) });
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
  // A folder only groups favorites, so an un-favorited channel leaves every folder.
  if (exists && state.folders.some((f) => f.channelIds.includes(channel.id))) {
    await persist(
      'folders',
      state.folders.map((f) => ({ ...f, channelIds: f.channelIds.filter((id) => id !== channel.id) })),
    );
  }
}

const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ').slice(0, FOLDER_NAME_MAX);
const sameName = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/** Creates a folder and returns its id; a name already in use returns that folder. Null if empty or at the limit. */
export async function createFolder(name: string): Promise<string | null> {
  await loadLibrary();
  const clean = cleanName(name);
  if (!clean) return null;
  const existing = state.folders.find((f) => sameName(f.name, clean));
  if (existing) return existing.id;
  if (state.folders.length >= FOLDER_LIMIT) return null;
  const folder: Folder = { id: crypto.randomUUID(), name: clean, channelIds: [] };
  await persist('folders', [...state.folders, folder]);
  return folder.id;
}

/** False if the name is empty or taken by another folder. */
export async function renameFolder(id: string, name: string): Promise<boolean> {
  await loadLibrary();
  const clean = cleanName(name);
  if (!clean || state.folders.some((f) => f.id !== id && sameName(f.name, clean))) return false;
  await persist(
    'folders',
    state.folders.map((f) => (f.id === id ? { ...f, name: clean } : f)),
  );
  return true;
}

/** The channels stay in favorites. */
export async function deleteFolder(id: string) {
  await loadLibrary();
  await persist(
    'folders',
    state.folders.filter((f) => f.id !== id),
  );
}

export async function toggleInFolder(folderId: string, channelId: string) {
  await loadLibrary();
  await persist(
    'folders',
    state.folders.map((f) =>
      f.id !== folderId
        ? f
        : {
            ...f,
            channelIds: f.channelIds.includes(channelId)
              ? f.channelIds.filter((id) => id !== channelId)
              : [...f.channelIds, channelId],
          },
    ),
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
