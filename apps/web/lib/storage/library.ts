'use client';

import type { ChannelSummary } from '@tunely/shared';
import { createStore, get, setMany, update, type UseStore } from 'idb-keyval';
import { useSyncExternalStore } from 'react';
import { FOLDER_LIMIT, FOLDER_NAME_MAX, HISTORY_LIMIT } from './limits';

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

export interface Library {
  favorites: ChannelSummary[];
  history: HistoryEntry[];
  folders: Folder[];
}

export { FOLDER_LIMIT, FOLDER_NAME_MAX, HISTORY_LIMIT };

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
  onAir: [], // programmes go stale; lists bring fresh ones
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
const list = <T>(value: unknown): T[] => (Array.isArray(value) ? value : []);
const READ: { [K in keyof Library]: (stored: unknown) => Library[K] } = {
  favorites: list,
  history: list,
  folders: validFolders,
};

let idb: UseStore | null = null;
const store = () => (idb ??= createStore('tunely', 'library'));

let state: Library = EMPTY;
let loaded: Promise<void> | null = null;
let watching = false;
const listeners = new Set<() => void>();
/** Told about the viewer's own changes (not loads or imports): account sync uploads them. */
const editListeners = new Set<() => void>();
export function onLibraryEdit(fn: () => void) {
  editListeners.add(fn);
  return () => void editListeners.delete(fn);
}

function emit(next: Library) {
  state = next;
  listeners.forEach((l) => l());
}

export function loadLibrary(): Promise<void> {
  // Another tab may have changed the library while this one was in the background: read it again on return.
  if (!watching && typeof document !== 'undefined') {
    watching = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      loaded = null;
      void loadLibrary();
    });
  }
  loaded ??= (async () => {
    try {
      const [favorites, history, folders] = await Promise.all([
        get('favorites', store()),
        get('history', store()),
        get('folders', store()),
      ]);
      emit({
        favorites: READ.favorites(favorites),
        history: READ.history(history),
        folders: READ.folders(folders),
      });
    } catch {
      // Private mode or blocked storage: the app still works, lists just stay empty.
    }
  })();
  return loaded;
}

/**
 * Apply `fn` to what is stored, read and written in one transaction, so a change made in another tab is never
 * overwritten by this tab's older copy. Returns the new value.
 */
async function change<K extends keyof Library>(
  key: K,
  fn: (current: Library[K]) => Library[K],
  quiet = false,
) {
  await loadLibrary();
  // Show the change at once (a controlled checkbox would otherwise snap back until the write lands); the stored
  // merge below then folds in any other tab's changes.
  emit({ ...state, [key]: fn(state[key]) });
  let next: Library[K] | undefined;
  try {
    await update(key, (stored) => (next = fn(READ[key](stored))), store());
  } catch {
    // Storage blocked (see loadLibrary): the change applies to this page view only.
  }
  next ??= fn(state[key]);
  emit({ ...state, [key]: next });
  if (!quiet) editListeners.forEach((l) => l());
  return next;
}

/** The library as stored now. */
export async function readLibrary(): Promise<Library> {
  await loadLibrary();
  return state;
}

/** Replace the whole library (account sync); not reported as an edit. */
export async function replaceLibrary(next: Library) {
  await loadLibrary();
  const clean: Library = {
    favorites: READ.favorites(next.favorites),
    history: READ.history(next.history),
    folders: READ.folders(next.folders),
  };
  try {
    await setMany(Object.entries(clean), store());
  } catch {
    // Storage blocked: this page view still shows it.
  }
  emit(clean);
}

export async function toggleFavorite(channel: ChannelSummary) {
  const favorites = await change('favorites', (list) =>
    list.some((c) => c.id === channel.id)
      ? list.filter((c) => c.id !== channel.id)
      : [snapshot(channel), ...list],
  );
  // A folder only groups favorites, so an un-favorited channel leaves every folder.
  if (!favorites.some((c) => c.id === channel.id)) {
    await change('folders', (folders) =>
      folders.map((f) => ({ ...f, channelIds: f.channelIds.filter((id) => id !== channel.id) })),
    );
  }
}

const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ').slice(0, FOLDER_NAME_MAX);
const sameName = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/** Creates a folder and returns its id; a name already in use returns that folder. Null if empty or at the limit. */
export async function createFolder(name: string): Promise<string | null> {
  const clean = cleanName(name);
  if (!clean) return null;
  const id = crypto.randomUUID(); // outside fn: change() applies it twice and both must agree
  const folders = await change('folders', (folders) =>
    folders.some((f) => sameName(f.name, clean)) || folders.length >= FOLDER_LIMIT
      ? folders
      : [...folders, { id, name: clean, channelIds: [] }],
  );
  return folders.find((f) => sameName(f.name, clean))?.id ?? null;
}

/** False if the name is empty or taken by another folder. */
export async function renameFolder(id: string, name: string): Promise<boolean> {
  const clean = cleanName(name);
  if (!clean) return false;
  const folders = await change('folders', (folders) =>
    folders.some((f) => f.id !== id && sameName(f.name, clean))
      ? folders
      : folders.map((f) => (f.id === id ? { ...f, name: clean } : f)),
  );
  return folders.some((f) => f.id === id && f.name === clean);
}

/** The channels stay in favorites. */
export async function deleteFolder(id: string) {
  await change('folders', (folders) => folders.filter((f) => f.id !== id));
}

export async function toggleInFolder(folderId: string, channelId: string) {
  await change('folders', (folders) =>
    folders.map((f) =>
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
  await change('history', (history) => {
    const prev = history.find((h) => h.channel.id === channel.id);
    const entry: HistoryEntry = {
      channel: snapshot(channel),
      lastWatchedAt: now,
      watchSeconds: (prev?.watchSeconds ?? 0) + Math.round(seconds),
    };
    return [entry, ...history.filter((h) => h.channel.id !== channel.id)].slice(0, HISTORY_LIMIT);
  });
}

export async function removeFromHistory(channelId: string) {
  await change('history', (history) => history.filter((h) => h.channel.id !== channelId));
}

export async function clearHistory() {
  await change('history', () => []);
}

/** Store fresh card fields (status, logo, name) for favorites, so the next visit compares against today. */
export async function refreshFavorites(fresh: ChannelSummary[]) {
  const byId = new Map(fresh.map((c) => [c.id, c]));
  await change(
    'favorites',
    (list) =>
      list.map((c) => {
        const f = byId.get(c.id);
        return f ? snapshot(f) : c;
      }),
    true, // an automatic refresh, not the viewer's edit
  );
}

/** Ids of favorites that were not live when last stored and are live now. */
export function backOnline(stored: ChannelSummary[], fresh: ChannelSummary[]): Set<string> {
  const was = new Map(stored.map((c) => [c.id, c.status ?? 'live']));
  return new Set(
    fresh.filter((c) => c.status === 'live' && was.has(c.id) && was.get(c.id) !== 'live').map((c) => c.id),
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
