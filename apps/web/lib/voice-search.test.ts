import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useVoiceSearch } from './voice-search';

class FakeRecognition {
  static last: FakeRecognition;
  lang = '';
  interimResults = false;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn(() => this.onend?.());
  constructor() {
    FakeRecognition.last = this;
  }
  hear(...parts: string[]) {
    this.onresult?.({ results: parts.map((transcript) => [{ transcript }]) });
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('not offered where the browser has no speech recognition', () => {
  const { result } = renderHook(() => useVoiceSearch(() => {}));
  expect(result.current.supported).toBe(false);
});

test('fills in the words as they are heard, then stops on a second tap', () => {
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
  vi.stubGlobal('navigator', { ...navigator, language: 'en-IN' });
  const onText = vi.fn();
  const { result } = renderHook(() => useVoiceSearch(onText));
  expect(result.current.supported).toBe(true);

  act(() => result.current.toggle());
  const rec = FakeRecognition.last;
  expect(rec.start).toHaveBeenCalled();
  expect(rec.lang).toBe('en-IN');
  expect(rec.interimResults).toBe(true);
  expect(result.current.state).toBe('listening');

  act(() => rec.hear('sun', ' tv '));
  expect(onText).toHaveBeenLastCalledWith('sun tv');

  act(() => result.current.toggle());
  expect(rec.stop).toHaveBeenCalled();
  expect(result.current.state).toBe('idle');
});

test('non-English locales keep the default English recogniser', () => {
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
  vi.stubGlobal('navigator', { ...navigator, language: 'ta-IN' });
  const { result } = renderHook(() => useVoiceSearch(() => {}));
  act(() => result.current.toggle());
  expect(FakeRecognition.last.lang).toBe('');
});

test('says so when the microphone is blocked, until the next try', () => {
  vi.stubGlobal('SpeechRecognition', FakeRecognition);
  const { result } = renderHook(() => useVoiceSearch(() => {}));
  act(() => result.current.toggle());
  act(() => {
    FakeRecognition.last.onerror?.({ error: 'not-allowed' });
    FakeRecognition.last.onend?.();
  });
  expect(result.current.state).toBe('blocked');
  act(() => result.current.toggle());
  expect(result.current.state).toBe('listening');
});

test('closing the search drops what was being heard', () => {
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
  const { result } = renderHook(() => useVoiceSearch(() => {}));
  act(() => result.current.toggle());
  const first = FakeRecognition.last;
  act(() => result.current.cancel());
  expect(first.abort).toHaveBeenCalled();
  expect(result.current.state).toBe('idle');
  // A late end from the aborted session must not clear a new one.
  act(() => result.current.toggle());
  act(() => first.onend?.());
  expect(result.current.state).toBe('listening');
});
