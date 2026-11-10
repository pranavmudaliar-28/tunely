import { expect, test } from 'vitest';
import { deadAirDetector, lumaChange, meanLuma, rms, type DeadAirSample } from './dead-air';

const frame = (v: number, n = 4) => new Uint8ClampedArray(Array.from({ length: n * 4 }, (_, i) => (i % 4 === 3 ? 255 : v)));

test('frame and audio measures', () => {
  expect(meanLuma(frame(0))).toBe(0);
  expect(meanLuma(frame(200))).toBeCloseTo(200);
  expect(lumaChange(frame(10), frame(30))).toBeCloseTo(20);
  expect(rms(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5);
});

const run = (samples: Omit<DeadAirSample, 'at'>[], windowMs = 6000) => {
  const detect = deadAirDetector(windowMs);
  return samples.map((s, i) => detect({ ...s, at: i * 2000 }));
};
const still = { luma: 120, change: 0.2, advancing: true };

test('a still, silent picture is dead air after the window', () => {
  expect(run(Array(5).fill({ ...still, silent: true }))).toEqual([false, false, false, true, true]);
});

test('a still picture with sound (radio) is not', () => {
  expect(run(Array(6).fill({ ...still, silent: false })).some(Boolean)).toBe(false);
});

test('without a sound measure only a black, still picture counts', () => {
  expect(run(Array(6).fill({ ...still, silent: null })).some(Boolean)).toBe(false);
  expect(run(Array(5).fill({ ...still, luma: 3, silent: null })).at(-1)).toBe(true);
});

test('movement, a stall or sound resets the clock', () => {
  const dead = { ...still, silent: true };
  expect(run([dead, dead, { ...dead, change: 9 }, dead, dead, dead])).toEqual([false, false, false, false, false, false]);
  expect(run([dead, dead, { ...dead, advancing: false }, dead, dead, dead, dead])).toEqual([
    false,
    false,
    false,
    false,
    false,
    false,
    true,
  ]);
});
