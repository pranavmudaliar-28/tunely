'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

// The browser's own speech recognition (Chrome, Edge, Safari). Audio goes to the browser's speech
// service (Google or Apple), never to us. TypeScript's DOM lib has the events but not the class yet.
interface Recognition {
  lang: string;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionClass = new () => Recognition;

const speechClass = (): RecognitionClass | undefined => {
  const w = window as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};
const noopSubscribe = () => () => {};

export type VoiceState = 'idle' | 'listening' | 'blocked';

/** Tap to talk: `onText` gets the words as they're heard; tap again to stop early. */
export function useVoiceSearch(onText: (text: string) => void) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => Boolean(speechClass()),
    () => false,
  );
  const [state, setState] = useState<VoiceState>('idle');
  const rec = useRef<Recognition | null>(null);
  const textRef = useRef(onText);
  useEffect(() => {
    textRef.current = onText;
  }, [onText]);

  const toggle = useCallback(() => {
    if (rec.current) return rec.current.stop(); // keeps what was heard so far
    const Speech = speechClass();
    if (!Speech) return;
    const r = new Speech();
    // Indian English hears "Sun TV" or "Aaj Tak" better than US English; other locales keep the page's English,
    // because channel names are written in Latin letters.
    if (navigator.language.startsWith('en')) r.lang = navigator.language;
    r.interimResults = true;
    r.onresult = (e) =>
      textRef.current(
        Array.from(e.results, (res) => res[0]?.transcript ?? '')
          .join('')
          .trim(),
      );
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setState('blocked');
    };
    r.onend = () => {
      if (rec.current !== r) return; // an aborted session ending late
      rec.current = null;
      setState((s) => (s === 'listening' ? 'idle' : s));
    };
    rec.current = r;
    setState('listening');
    r.start();
  }, []);

  /** Stop without using what was heard (the search closed). */
  const cancel = useCallback(() => {
    rec.current?.abort();
    rec.current = null;
    setState('idle');
  }, []);
  useEffect(() => cancel, [cancel]);

  return { supported, state, toggle, cancel };
}
