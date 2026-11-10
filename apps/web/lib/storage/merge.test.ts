import type { ChannelSummary } from '@tunely/shared';
import { expect, test } from 'vitest';
import { mergeDocs } from './merge';
import { SyncDocSchema, type SyncDoc } from './sync-schema';

const ch = (id: string): ChannelSummary => ({
  id,
  name: id,
  country: 'IN',
  categories: [],
  languages: [],
  logo: null,
  quality: null,
  status: 'live',
  onAir: [],
});
const doc = (d: Partial<SyncDoc>): SyncDoc => ({ favorites: [], history: [], folders: [], prefs: {}, ...d });

test('favorites: mine first, then theirs, no repeats', () => {
  const merged = mergeDocs(doc({ favorites: [ch('A'), ch('B')] }), doc({ favorites: [ch('B'), ch('C')] }));
  expect(merged.favorites.map((c) => c.id)).toEqual(['A', 'B', 'C']);
});

test('folders with the same id or name combine; channels must be favorites', () => {
  const merged = mergeDocs(
    doc({ favorites: [ch('A'), ch('B')], folders: [{ id: '1', name: 'News', channelIds: ['A'] }] }),
    doc({
      favorites: [ch('C')],
      folders: [
        { id: '2', name: 'news', channelIds: ['B', 'C', 'Gone'] },
        { id: '3', name: 'Kids', channelIds: ['C'] },
      ],
    }),
  );
  expect(merged.folders).toEqual([
    { id: '1', name: 'News', channelIds: ['A', 'B', 'C'] },
    { id: '3', name: 'Kids', channelIds: ['C'] },
  ]);
});

test('history keeps the latest watch and the larger total, newest first', () => {
  const merged = mergeDocs(
    doc({ history: [{ channel: ch('A'), lastWatchedAt: 10, watchSeconds: 60 }] }),
    doc({
      history: [
        { channel: ch('A'), lastWatchedAt: 20, watchSeconds: 30 },
        { channel: ch('B'), lastWatchedAt: 15, watchSeconds: 5 },
      ],
    }),
  );
  expect(merged.history.map((h) => [h.channel.id, h.lastWatchedAt, h.watchSeconds])).toEqual([
    ['A', 20, 60],
    ['B', 15, 5],
  ]);
});

test("prefs: this device's choices win, the other fills gaps", () => {
  const merged = mergeDocs(doc({ prefs: { country: 'IN' } }), doc({ prefs: { country: 'US', dataSaver: 'on' } }));
  expect(merged.prefs).toEqual({ country: 'IN', dataSaver: 'on' });
});

test('the server schema caps what it stores', () => {
  expect(SyncDocSchema.safeParse(doc({ favorites: [ch('A')] })).success).toBe(true);
  const tooMany = Array.from({ length: 21 }, (_, i) => ({ id: `${i}`, name: `F${i}`, channelIds: [] }));
  expect(SyncDocSchema.safeParse(doc({ folders: tooMany })).success).toBe(false);
  expect(SyncDocSchema.safeParse({ favorites: 'x' }).success).toBe(false);
});
