import { describe, expect, test } from 'vitest';
import { classifyHlsError } from './attach';
import { initialPlayerState, playerReducer } from './state';
import { neighbour } from './store';

describe('playerReducer', () => {
  test('falls through to the next stream before showing an error', () => {
    let s = initialPlayerState(2);
    s = playerReducer(s, { type: 'error', error: 'offline' });
    expect(s).toMatchObject({ status: 'loading', streamIndex: 1 });
    s = playerReducer(s, { type: 'error', error: 'timeout' });
    expect(s).toMatchObject({ status: 'error', streamIndex: 1, error: 'offline' });
  });

  test('keeps the most specific error across streams', () => {
    let s = initialPlayerState(2);
    s = playerReducer(s, { type: 'error', error: 'geo_blocked' });
    s = playerReducer(s, { type: 'error', error: 'offline' });
    expect(s.error).toBe('geo_blocked');
  });

  test('playing clears errors; retry starts over from the best stream', () => {
    let s = playerReducer(initialPlayerState(3), { type: 'error', error: 'offline' });
    s = playerReducer(s, { type: 'playing' });
    expect(s).toMatchObject({ status: 'playing', streamIndex: 1, error: null });
    s = playerReducer(
      playerReducer(playerReducer(s, { type: 'error', error: 'media' }), { type: 'error', error: 'media' }),
      {
        type: 'retry',
      },
    );
    expect(s).toMatchObject({ status: 'loading', streamIndex: 0 });
  });

  test('a channel with no web streams is an error immediately', () => {
    expect(initialPlayerState(0)).toMatchObject({ status: 'error', error: 'offline' });
  });

  test('every load gets a new attempt number', () => {
    const a = initialPlayerState(1);
    const b = playerReducer(a, { type: 'retry' });
    const c = playerReducer(b, { type: 'channel', streamCount: 1 });
    expect(new Set([a.attempt, b.attempt, c.attempt]).size).toBe(3);
  });
});

test('classifyHlsError', () => {
  expect(
    classifyHlsError({
      type: 'networkError' as never,
      details: 'manifestLoadError' as never,
      response: { code: 403, text: '', url: '' },
    }),
  ).toBe('geo_blocked');
  expect(
    classifyHlsError({
      type: 'networkError' as never,
      details: 'manifestLoadError' as never,
      response: { code: 0, text: '', url: '' },
    }),
  ).toBe('browser_blocked');
  expect(classifyHlsError({ type: 'networkError' as never, details: 'manifestLoadTimeOut' as never })).toBe(
    'timeout',
  );
  expect(
    classifyHlsError({
      type: 'networkError' as never,
      details: 'fragLoadError' as never,
      response: { code: 404, text: '', url: '' },
    }),
  ).toBe('offline');
  expect(classifyHlsError({ type: 'mediaError' as never, details: 'bufferStalledError' as never })).toBe(
    'media',
  );
});

test('neighbour wraps around the lineup', () => {
  const lineup = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  expect(neighbour(lineup, 'a', -1)).toBe('c');
  expect(neighbour(lineup, 'c', 1)).toBe('a');
  expect(neighbour(lineup, 'x', 1)).toBeNull();
});
