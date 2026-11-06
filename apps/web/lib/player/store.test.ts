import { beforeEach, expect, test } from 'vitest';
import { capLevel, preferredLevel, usePlayerStore } from './store';

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

test('capLevel: best level no taller than the cap, else the smallest', () => {
  const hls = [
    { height: 360, bitrate: 800 },
    { height: 480, bitrate: 1200 },
    { height: 480, bitrate: 1500 },
    { height: 1080, bitrate: 5000 },
  ];
  expect(capLevel(hls, 480)).toBe(2);
  expect(capLevel(hls, 400)).toBe(0);
  expect(
    capLevel(
      [
        { height: 720, bitrate: 1 },
        { height: 1080, bitrate: 2 },
      ],
      480,
    ),
  ).toBe(0);
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

test('volume, mute, quality and captions outlive the visit; the lineup and last channel stay with the tab', () => {
  const s = usePlayerStore.getState();
  s.setVolume(0.3);
  s.setQuality(720);
  s.setCaptions('en');
  s.setLineup([{ id: 'a', name: 'A', status: 'live' }]);
  s.setPrevious({ id: 'b', name: 'B' });
  expect(JSON.parse(localStorage.getItem('tunely.player')!).state).toEqual({
    muted: false,
    volume: 0.3,
    quality: 720,
    captions: 'en',
  });
  expect(JSON.parse(sessionStorage.getItem('tunely.player')!).state).toEqual({
    lineup: [{ id: 'a', name: 'A', status: 'live' }],
    previous: { id: 'b', name: 'B' },
  });
});
