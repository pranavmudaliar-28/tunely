import { FOLDER_LIMIT, HISTORY_LIMIT } from './limits';
import type { SyncDoc } from './sync-schema';

/**
 * Two copies of a viewer's library combined, `mine` first: used on a device's first sign-in and when both this
 * device and another changed it. Nothing is lost; something removed on only one side comes back (no tombstones).
 */
export function mergeDocs(mine: SyncDoc, theirs: SyncDoc): SyncDoc {
  const ids = new Set(mine.favorites.map((c) => c.id));
  const favorites = [...mine.favorites, ...theirs.favorites.filter((c) => !ids.has(c.id))];

  const folders = mine.folders.map((f) => ({ ...f, channelIds: [...f.channelIds] }));
  for (const f of theirs.folders) {
    const same = folders.find(
      (x) => x.id === f.id || x.name.toLocaleLowerCase() === f.name.toLocaleLowerCase(),
    );
    if (same) same.channelIds = [...new Set([...same.channelIds, ...f.channelIds])];
    else if (folders.length < FOLDER_LIMIT) folders.push({ ...f, channelIds: [...f.channelIds] });
  }
  // A folder only groups favorites.
  const favorite = new Set(favorites.map((c) => c.id));
  for (const f of folders) f.channelIds = f.channelIds.filter((id) => favorite.has(id));

  // The same watch can be in both copies (an earlier sync), so totals take the larger, not the sum.
  const byId = new Map<string, SyncDoc['history'][number]>();
  for (const h of [...mine.history, ...theirs.history]) {
    const p = byId.get(h.channel.id);
    byId.set(
      h.channel.id,
      !p
        ? h
        : {
            channel: p.lastWatchedAt >= h.lastWatchedAt ? p.channel : h.channel,
            lastWatchedAt: Math.max(p.lastWatchedAt, h.lastWatchedAt),
            watchSeconds: Math.max(p.watchSeconds, h.watchSeconds),
          },
    );
  }
  const history = [...byId.values()].sort((a, b) => b.lastWatchedAt - a.lastWatchedAt).slice(0, HISTORY_LIMIT);

  const prefs = { ...theirs.prefs };
  for (const [k, v] of Object.entries(mine.prefs)) if (v !== undefined) prefs[k] = v;
  return { favorites, folders, history, prefs };
}
