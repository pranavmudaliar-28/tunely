import { beforeEach, expect, test } from 'vitest';
import { preferredLevel, usePlayerStore } from './store';

const levels = [
  { index: 2, height: 1080 },
  { index: 1, height: 720 },
  { index: 0, height: 360 },
];

test('preferredLevel picks the closest height at or below the preference', () => {
  expect(preferredLevel(levels, null)).toBe(-1);
  expect(preferredLevel(levels, 720)).toBe(1);
  expect(preferredLevel(levels, 900)).toBe(1);
  expect(preferredLevel(levels, 2160)).toBe(2);
  expect(preferredLevel(levels, 240)).toBe(-1); // nothing small enough: Auto
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

test('volume, mute and quality outlive the visit; the lineup stays with the tab', () => {
  const s = usePlayerStore.getState();
  s.setVolume(0.3);
  s.setQuality(720);
  s.setLineup([{ id: 'a', name: 'A', status: 'live' }]);
  expect(JSON.parse(localStorage.getItem('tunely.player')!).state).toEqual({
    muted: false,
    volume: 0.3,
    quality: 720,
  });
  expect(JSON.parse(sessionStorage.getItem('tunely.player')!).state).toEqual({
    lineup: [{ id: 'a', name: 'A', status: 'live' }],
  });
});
