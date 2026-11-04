import type { ChannelSummary } from '@tunely/shared';
import { clear, createStore, set } from 'idb-keyval';
import { beforeEach, expect, test } from 'vitest';
import {
  __resetLibrary,
  createFolder,
  deleteFolder,
  FOLDER_LIMIT,
  loadLibrary,
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
