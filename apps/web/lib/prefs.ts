'use client';

import { useSyncExternalStore } from 'react';

/** Viewer preferences, kept in this browser only. */
export interface Prefs {
  /** ISO 3166 code; unset = detect from the connection (/geo). */
  country?: string;
  /** ISO 639-3 codes, in the viewer's order. */
  languages?: string[];
  /** The first-visit question was answered or skipped. */
  asked?: boolean;
  /** Cap video at 480p. Unset = automatic: on when the browser reports mobile data or Save-Data. */
  dataSaver?: 'on' | 'off';
}

/** Height cap while data saver is on. */
export const DATA_SAVER_HEIGHT = 480;

export function dataSaverOn(setting: Prefs['dataSaver'], connection?: { saveData?: boolean; type?: string }) {
  if (setting) return setting === 'on';
  return connection?.saveData === true || connection?.type === 'cellular';
}

export const PREFS_KEY = 'tunely.prefs';
export const MAX_LANGUAGES = 3;

/** Stored data can be stale or edited by hand: keep only well-formed values. */
export function cleanPrefs(value: unknown): Prefs {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const prefs: Prefs = {};
  if (typeof v.country === 'string' && /^[A-Z]{2}$/.test(v.country)) prefs.country = v.country;
  if (Array.isArray(v.languages)) {
    const langs = v.languages.filter((l): l is string => typeof l === 'string' && /^[a-z]{2,3}$/.test(l));
    if (langs.length) prefs.languages = [...new Set(langs)].slice(0, MAX_LANGUAGES);
  }
  if (v.asked === true) prefs.asked = true;
  if (v.dataSaver === 'on' || v.dataSaver === 'off') prefs.dataSaver = v.dataSaver;
  return prefs;
}

function read(): Prefs {
  try {
    return cleanPrefs(JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}'));
  } catch {
    return {};
  }
}

let cache: Prefs | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Merge `patch` into the stored prefs; `undefined` clears a field. */
export function savePrefs(patch: Partial<Prefs>) {
  // The in-memory copy is current for this tab (another tab's change resets it), and survives blocked storage.
  const next = cleanPrefs({ ...(cache ?? read()), ...patch });
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the choice applies until the page is closed.
  }
  cache = next;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed them.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== PREFS_KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Current prefs outside React (e.g. when the player picks a quality). */
export const getPrefs = (): Prefs => (cache ??= read());

/** Null on the server and during hydration, so cached pages render the same for everyone. */
export function usePrefs(): Prefs | null {
  return useSyncExternalStore(
    subscribe,
    () => (cache ??= read()),
    () => null,
  );
}

/** Test helper. */
export function __resetPrefs() {
  cache = null;
}
