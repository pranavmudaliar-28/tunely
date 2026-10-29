import type { PlaybackError } from './attach';

// One channel can have several web-playable streams (best first). A failing stream falls through
// to the next one silently; the viewer only sees an error once every stream has failed.

export type PlayerStatus = 'loading' | 'playing' | 'paused' | 'error';

export interface PlayerState {
  status: PlayerStatus;
  streamIndex: number;
  streamCount: number;
  error: PlaybackError | null;
  /** Bumped on every (re)load so effects re-attach even when the index is unchanged (retry). */
  attempt: number;
}

export type PlayerEvent =
  | { type: 'channel'; streamCount: number }
  | { type: 'playing' }
  | { type: 'paused' }
  | { type: 'error'; error: PlaybackError }
  | { type: 'retry' };

export const initialPlayerState = (streamCount: number): PlayerState => ({
  status: streamCount ? 'loading' : 'error',
  streamIndex: 0,
  streamCount,
  error: streamCount ? null : 'offline',
  attempt: 0,
});

/** Which error to show when every stream failed: the most specific one wins. */
const PRIORITY: PlaybackError[] = [
  'geo_blocked',
  'browser_blocked',
  'unsupported_codec',
  'offline',
  'timeout',
  'media',
  'unknown',
];

export function playerReducer(state: PlayerState, event: PlayerEvent): PlayerState {
  switch (event.type) {
    case 'channel':
      return { ...initialPlayerState(event.streamCount), attempt: state.attempt + 1 };
    case 'playing':
      return state.status === 'error' ? state : { ...state, status: 'playing', error: null };
    case 'paused':
      return state.status === 'playing' ? { ...state, status: 'paused' } : state;
    case 'error': {
      if (state.status === 'error') return state;
      const worst =
        state.error && PRIORITY.indexOf(state.error) < PRIORITY.indexOf(event.error)
          ? state.error
          : event.error;
      if (state.streamIndex + 1 < state.streamCount) {
        return {
          ...state,
          status: 'loading',
          streamIndex: state.streamIndex + 1,
          error: worst,
          attempt: state.attempt + 1,
        };
      }
      return { ...state, status: 'error', error: worst };
    }
    case 'retry':
      return { ...initialPlayerState(state.streamCount), attempt: state.attempt + 1 };
  }
}
