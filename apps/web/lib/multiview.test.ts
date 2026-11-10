import { expect, test } from 'vitest';
import { parseTiles, tilesHref } from './multiview';

test('parseTiles keeps up to 4 distinct, plausible ids', () => {
  expect(parseTiles('DDNews.in,ABCKids.au,DDNews.in')).toEqual(['DDNews.in', 'ABCKids.au']);
  expect(parseTiles('a,b,c,d,e')).toEqual(['a', 'b', 'c', 'd']);
  expect(parseTiles('../x,<script>,ok.us,')).toEqual(['ok.us']);
  expect(parseTiles(null)).toEqual([]);
});

test('tilesHref round-trips', () => {
  expect(tilesHref(['DDNews.in', 'CNN.us@East'])).toBe('/multiview?c=DDNews.in,CNN.us%40East');
  expect(parseTiles(new URL(`http://x${tilesHref(['CNN.us@East'])}`).searchParams.get('c'))).toEqual(['CNN.us@East']);
  expect(tilesHref([])).toBe('/multiview');
});
