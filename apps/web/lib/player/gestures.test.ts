import { expect, test } from 'vitest';
import { swipeDirection, tapSide } from './gestures';

test('a quick vertical flick is a swipe; slow, short or sideways moves are not', () => {
  expect(swipeDirection(5, -120, 200)).toBe('up');
  expect(swipeDirection(-10, 90, 300)).toBe('down');
  expect(swipeDirection(0, -40, 100)).toBeNull(); // too short
  expect(swipeDirection(0, -200, 900)).toBeNull(); // too slow: a drag, not a flick
  expect(swipeDirection(80, -100, 200)).toBeNull(); // too diagonal
});

test('taps are sorted into thirds', () => {
  expect(tapSide(10, 300)).toBe('left');
  expect(tapSide(150, 300)).toBe('center');
  expect(tapSide(290, 300)).toBe('right');
});
