import { expect, test } from 'vitest';
import { nextInDirection } from './spatial';

// Two rails of three 100×60 cards, 20 px apart, rails 100 px apart; a nav item on the far left.
const card = (col: number, row: number) => ({
  left: 120 + col * 120,
  top: row * 160,
  width: 100,
  height: 60,
});
const nav = { left: 0, top: 0, width: 72, height: 60 };
const boxes = [card(0, 0), card(1, 0), card(2, 0), card(0, 1), card(1, 1), card(2, 1), nav];

test('left and right move along a rail; left from the first card reaches the nav', () => {
  expect(nextInDirection(card(0, 0), boxes, 'right')).toBe(1);
  expect(nextInDirection(card(2, 0), boxes, 'right')).toBe(-1);
  expect(nextInDirection(card(1, 0), boxes, 'left')).toBe(0);
  expect(nextInDirection(card(0, 0), boxes, 'left')).toBe(6);
});

test('up and down go to the card straight above or below', () => {
  expect(nextInDirection(card(1, 0), boxes, 'down')).toBe(4);
  expect(nextInDirection(card(2, 1), boxes, 'up')).toBe(2);
  expect(nextInDirection(card(1, 1), boxes, 'down')).toBe(-1);
});
