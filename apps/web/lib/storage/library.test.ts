import type { ChannelSummary } from '@tunely/shared';
import { clear, createStore, set } from 'idb-keyval';
import { beforeEach, expect, test } from 'vitest';
import {
  __resetLibrary,
  backOnline,
  clearHistory,
  createFolder,
  deleteFolder,
  FOLDER_LIMIT,
  loadLibrary,
  recordWatch,
  refreshFavorites,
  removeFromHistory,
  renameFolder,
  toggleFavorite,
  toggleInFolder,
  useLibrary,
} from './library';
import { renderHook } from '@testing-library/react';

const channel = (id: string): ChannelSummary => ({
  id,
  name: id,
  country: 'IN',
  categories: ['news'],
  languages: ['hin'],
  logo: null,
  quality: null,
  status: 'live',
  onAir: [],
});
const library = () => renderHook(() => useLibrary()).result.current;

beforeEach(async () => {
  // Clear rather than delete the database: a delete waits for the previous test's open connection.
  await clear(createStore('tunely', 'library'));
  __resetLibrary();
  await loadLibrary();
});

test('create, rename and delete a folder; duplicate names reuse it', async () => {
  const id = (await createFolder('  News  '))!;
  expect(await createFolder('news')).toBe(id);
  expect(library().folders).toEqual([{ id, name: 'News', channelIds: [] }]);
  expect(await createFolder('   ')).toBeNull();

  const kids = (await createFolder('Kids'))!;
  expect(await renameFolder(kids, 'NEWS')).toBe(false); // taken
  expect(await renameFolder(kids, 'Cartoons')).toBe(true);
  expect(library().folders.map((f) => f.name)).toEqual(['News', 'Cartoons']);

  await deleteFolder(id);
  expect(library().folders.map((f) => f.name)).toEqual(['Cartoons']);
});

test('folders hold favorites; un-favoriting removes a channel from every folder', async () => {
  await toggleFavorite(channel('a'));
  await toggleFavorite(channel('b'));
  const news = (await createFolder('News'))!;
  const hindi = (await createFolder('Hindi'))!;
  await toggleInFolder(news, 'a');
  await toggleInFolder(hindi, 'a');
  await toggleInFolder(hindi, 'b');
  await toggleInFolder(hindi, 'b'); // toggles back out
  expect(library().folders.map((f) => f.channelIds)).toEqual([['a'], ['a']]);

  await toggleFavorite(channel('a'));
  expect(library().folders.map((f) => f.channelIds)).toEqual([[], []]);

  await deleteFolder(news);
  expect(library().favorites.map((c) => c.id)).toEqual(['b']); // deleting a folder keeps favorites
});

test('folders survive a reload, and there is a limit', async () => {
  await toggleFavorite(channel('a'));
  const id = (await createFolder('News'))!;
  await toggleInFolder(id, 'a');
  __resetLibrary();
  await loadLibrary();
  expect(library().folders).toEqual([{ id, name: 'News', channelIds: ['a'] }]);

  for (let i = 1; i < FOLDER_LIMIT; i++) await createFolder(`Folder ${i}`);
  expect(await createFolder('One too many')).toBeNull();
});

test("another tab's changes are kept, not overwritten by this tab's older copy", async () => {
  await toggleFavorite(channel('a'));
  const news = (await createFolder('News'))!;
  // Another tab favorites b and makes a folder straight in storage; this tab's copy has neither.
  const db = createStore('tunely', 'library');
  await set('favorites', [channel('b'), channel('a')], db);
  await set('folders', [...library().folders, { id: 'other', name: 'Kids', channelIds: ['b'] }], db);

  await toggleFavorite(channel('c'));
  await toggleInFolder(news, 'c');
  expect(library().favorites.map((c) => c.id)).toEqual(['c', 'b', 'a']);
  expect(library().folders.map((f) => [f.name, f.channelIds])).toEqual([
    ['News', ['c']],
    ['Kids', ['b']],
  ]);
});

test('malformed stored folders are ignored', async () => {
  await set(
    'folders',
    [
      { id: 'ok', name: 'Good', channelIds: ['a'] },
      { id: 1 },
      null,
      { id: 'x', name: 'Bad', channelIds: [2] },
    ],
    createStore('tunely', 'library'),
  );
  __resetLibrary();
  await loadLibrary();
  expect(library().folders).toEqual([{ id: 'ok', name: 'Good', channelIds: ['a'] }]);
});

test('remove one channel from history, or clear it all', async () => {
  await recordWatch(channel('a'), 60, 1);
  await recordWatch(channel('b'), 30, 2);
  await recordWatch(channel('c'), 0, 3);
  await removeFromHistory('b');
  expect(library().history.map((h) => h.channel.id)).toEqual(['c', 'a']);
  await clearHistory();
  expect(library().history).toEqual([]);
  __resetLibrary();
  await loadLibrary();
  expect(library().history).toEqual([]); // stored, not just in memory
});

test('favorites take fresh card fields; "back online" compares with what was stored', async () => {
  await toggleFavorite({ ...channel('a'), status: 'offline' });
  await toggleFavorite({ ...channel('b'), status: 'live' });
  await toggleFavorite({ ...channel('c'), status: 'offline' });
  const fresh = [
    { ...channel('a'), status: 'live' as const, logo: 'https://example.com/a.png' },
    { ...channel('b'), status: 'live' as const },
    { ...channel('c'), status: 'closed' as const },
    { ...channel('z'), status: 'live' as const }, // not a favorite
  ];
  expect([...backOnline(library().favorites, fresh)]).toEqual(['a']);

  await refreshFavorites(fresh);
  expect(library().favorites.map((c) => [c.id, c.status, c.logo])).toEqual([
    ['c', 'closed', null],
    ['b', 'live', null],
    ['a', 'live', 'https://example.com/a.png'],
  ]);
  // Next visit: nothing new came back.
  expect(backOnline(library().favorites, fresh).size).toBe(0);
});
