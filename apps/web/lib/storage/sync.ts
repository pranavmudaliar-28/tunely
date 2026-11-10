'use client';

import { cleanPrefs, getPrefs, onPrefsSaved, savePrefs } from '../prefs';
import { onLibraryEdit, readLibrary, replaceLibrary } from './library';
import { mergeDocs } from './merge';
import type { SyncDoc } from './sync-schema';

// Account sync: this browser's library and settings kept in step with the server copy while signed in.
// Only browsers that signed in here keep this record, so everyone else makes no account requests at all.

const META_KEY = 'tunely.sync';
interface Meta {
  userId: string;
  /** The server version this browser last matched. */
  version: string | null;
  /** Changed here since then. */
  dirty: boolean;
}

export function readSyncMeta(): Meta | null {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) ?? 'null') as Meta | null;
    return m && typeof m.userId === 'string' ? m : null;
  } catch {
    return null;
  }
}
function writeMeta(m: Meta | null) {
  try {
    if (m) localStorage.setItem(META_KEY, JSON.stringify(m));
    else localStorage.removeItem(META_KEY);
  } catch {
    // Storage blocked: sync runs for this page view only.
  }
}
/** Signed out here: stop syncing (the library stays in this browser). */
export const forgetSync = () => writeMeta(null);

async function local(): Promise<SyncDoc> {
  const { favorites, history, folders } = await readLibrary();
  return { favorites, history, folders, prefs: { ...getPrefs() } };
}

let applying = false;
async function apply(doc: SyncDoc) {
  applying = true;
  try {
    await replaceLibrary(doc);
    const p = cleanPrefs(doc.prefs);
    savePrefs({ country: p.country, languages: p.languages, asked: p.asked, dataSaver: p.dataSaver });
  } finally {
    applying = false;
  }
}

export type SyncResult = 'ok' | 'signed-out' | 'error';
let running: Promise<SyncResult> | null = null;
let edits = 0;

/** Bring this browser and the server copy into step. */
export function syncNow(userId: string): Promise<SyncResult> {
  running ??= run(userId).finally(() => (running = null));
  return running;
}

async function run(userId: string, retry = true): Promise<SyncResult> {
  const before = edits;
  const meta = readSyncMeta();
  const first = meta?.userId !== userId;
  try {
    const res = await fetch('/api/me/library', { cache: 'no-store' });
    if (res.status === 401) {
      writeMeta(null);
      return 'signed-out';
    }
    if (!res.ok) return 'error';
    const server = (await res.json()) as { data: SyncDoc | null; version: string | null };
    const mine = await local();
    let next = mine;
    let push = first || Boolean(meta?.dirty) || !server.data;
    if (server.data && (first || server.version !== meta?.version)) {
      // First sign-in here, or another device changed it: merge if this one changed too, else take theirs.
      next = first || meta?.dirty ? mergeDocs(mine, server.data) : server.data;
      push = first || Boolean(meta?.dirty);
      await apply(next);
    }
    let version = server.version;
    if (push) {
      const put = await fetch('/api/me/library', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: next, base: server.version }),
      });
      // Another device saved in between: take its copy into account and try once more.
      if (put.status === 409 && retry) return run(userId, false);
      if (!put.ok) {
        writeMeta({ userId, version: meta?.userId === userId ? meta.version : null, dirty: true });
        return 'error';
      }
      version = ((await put.json()) as { version: string }).version;
    }
    // An edit made while this ran is still to be sent.
    writeMeta({ userId, version, dirty: edits !== before });
    return 'ok';
  } catch {
    return 'error';
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Keep syncing while signed in: after edits (debounced), and when the tab comes back. Returns a stop function. */
export function startSync(userId: string): () => void {
  const edited = () => {
    if (applying) return;
    edits++;
    const m = readSyncMeta();
    if (m) writeMeta({ ...m, dirty: true });
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(userId), 5000);
  };
  const offLibrary = onLibraryEdit(edited);
  const offPrefs = onPrefsSaved(edited);
  const onVisible = () => {
    if (document.visibilityState === 'visible') void syncNow(userId);
  };
  document.addEventListener('visibilitychange', onVisible);
  void syncNow(userId);
  return () => {
    offLibrary();
    offPrefs();
    document.removeEventListener('visibilitychange', onVisible);
    clearTimeout(timer);
  };
}
