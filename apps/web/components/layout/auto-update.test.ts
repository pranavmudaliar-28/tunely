import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { checkForUpdate } from './auto-update';

const live = (build: string | null) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ json: async () => ({ build }) })),
  );

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

test('reloads into a new deploy when nothing is in use', async () => {
  live('new');
  const reload = vi.fn();
  expect(await checkForUpdate('old', reload)).toBe(true);
  expect(reload).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledWith('/version', { cache: 'no-store' });
});

test('stays put on the same deploy, or when the server has no build id', async () => {
  const reload = vi.fn();
  live('same');
  expect(await checkForUpdate('same', reload)).toBe(false);
  live(null);
  expect(await checkForUpdate('old', reload)).toBe(false);
  expect(reload).not.toHaveBeenCalled();
});

test('never interrupts a playing channel', async () => {
  live('new');
  const video = document.createElement('video');
  Object.defineProperty(video, 'paused', { value: false });
  document.body.append(video);
  const reload = vi.fn();
  expect(await checkForUpdate('old', reload)).toBe(false);
  expect(reload).not.toHaveBeenCalled();
});

test('never throws away what someone is typing', async () => {
  live('new');
  const box = document.createElement('textarea');
  document.body.append(box);
  box.focus();
  const reload = vi.fn();
  expect(await checkForUpdate('old', reload)).toBe(false);
});

test('tries once per deploy, so a mismatched build cannot loop', async () => {
  live('new');
  const reload = vi.fn();
  await checkForUpdate('old', reload);
  await checkForUpdate('old', reload);
  expect(reload).toHaveBeenCalledOnce();
  live('newer');
  await checkForUpdate('old', reload);
  expect(reload).toHaveBeenCalledTimes(2);
});

test('offline: no reload, no error', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Promise.reject(new TypeError('offline'))),
  );
  const reload = vi.fn();
  expect(await checkForUpdate('old', reload)).toBe(false);
});
