import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { __resetPrefs, cleanPrefs, dataSaverOn, PREFS_KEY, savePrefs, usePrefs } from './prefs';

beforeEach(() => {
  localStorage.clear();
  __resetPrefs();
});
afterEach(() => vi.restoreAllMocks());

test('cleanPrefs keeps only well-formed values', () => {
  expect(cleanPrefs({ country: 'DE', languages: ['tam', 'eng', 'tam'], asked: true })).toEqual({
    country: 'DE',
    languages: ['tam', 'eng'],
    asked: true,
  });
  expect(
    cleanPrefs({ country: 'germany', languages: ['<b>', 1, 'hin', 'eng', 'tam', 'ben'], asked: 'yes' }),
  ).toEqual({
    languages: ['hin', 'eng', 'tam'],
  });
  expect(cleanPrefs(null)).toEqual({});
  expect(cleanPrefs('x')).toEqual({});
});

test('saves, merges and clears fields', () => {
  savePrefs({ languages: ['tam'] });
  savePrefs({ country: 'IN' });
  expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({ languages: ['tam'], country: 'IN' });
  savePrefs({ country: undefined });
  expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({ languages: ['tam'] });
});

test('the hook updates when prefs change', () => {
  const { result } = renderHook(() => usePrefs());
  expect(result.current).toEqual({});
  act(() => savePrefs({ languages: ['ben'], asked: true }));
  expect(result.current).toEqual({ languages: ['ben'], asked: true });
});

test('blocked storage still applies the choice for this page view', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  const { result } = renderHook(() => usePrefs());
  expect(result.current).toEqual({});
  act(() => savePrefs({ country: 'FR' }));
  expect(result.current).toEqual({ country: 'FR' });
});

test('data saver: an explicit choice wins; automatic follows Save-Data and mobile data', () => {
  expect(dataSaverOn('on', { type: 'wifi' })).toBe(true);
  expect(dataSaverOn('off', { saveData: true })).toBe(false);
  expect(dataSaverOn(undefined, { type: 'cellular' })).toBe(true);
  expect(dataSaverOn(undefined, { saveData: true })).toBe(true);
  expect(dataSaverOn(undefined, { type: 'wifi' })).toBe(false);
  expect(dataSaverOn(undefined, undefined)).toBe(false); // browsers that don't say
  expect(cleanPrefs({ dataSaver: 'on' })).toEqual({ dataSaver: 'on' });
  expect(cleanPrefs({ dataSaver: 'maybe' })).toEqual({});
});
