'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { deadAirDetector, lumaChange, meanLuma, rms, SILENCE_RMS } from '@/lib/player/dead-air';

const EVERY_MS = 2000;

/** The sound level, read from a captured copy of the stream (Chromium): the element's own output is untouched. */
function listen(video: HTMLVideoElement): { silent(): boolean | null; close(): void } {
  const none = { silent: () => null, close() {} };
  const el = video as HTMLVideoElement & { captureStream?: () => MediaStream };
  if (typeof el.captureStream !== 'function' || typeof AudioContext === 'undefined') return none;
  try {
    const stream = el.captureStream();
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    const buf = new Float32Array(analyser.fftSize);
    let connected = false;
    return {
      silent() {
        if (!connected && stream.getAudioTracks().length) {
          // Not connected to the speakers: it only measures.
          ctx.createMediaStreamSource(stream).connect(analyser);
          connected = true;
        }
        // Runs once the page has had a click or tap; a suspended context would read as silence.
        if (ctx.state !== 'running') void ctx.resume().catch(() => {});
        if (!connected || ctx.state !== 'running') return null;
        analyser.getFloatTimeDomainData(buf);
        return rms(buf) < SILENCE_RMS;
      },
      close() {
        void ctx.close().catch(() => {});
        stream.getTracks().forEach((t) => t.stop());
      },
    };
  } catch {
    return none;
  }
}

/** Calls `onDead` once if the playing video shows dead air (see lib/player/dead-air). */
export function useDeadAir(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean, onDead: () => void) {
  const onDeadRef = useRef(onDead);
  useEffect(() => {
    onDeadRef.current = onDead;
  });
  useEffect(() => {
    const video = videoRef.current;
    if (!enabled || !video) return;
    const canvas = Object.assign(document.createElement('canvas'), { width: 32, height: 18 });
    const g = canvas.getContext('2d', { willReadFrequently: true });
    if (!g) return;
    const audio = listen(video);
    const detect = deadAirDetector();
    let prev: Uint8ClampedArray | null = null;
    let position = video.currentTime;
    const timer = setInterval(() => {
      if (video.paused || video.readyState < 2) return;
      let px: Uint8ClampedArray;
      try {
        g.drawImage(video, 0, 0, canvas.width, canvas.height);
        px = g.getImageData(0, 0, canvas.width, canvas.height).data;
      } catch {
        // A cross-origin picture can't be read (Safari's own player): no detection for this stream.
        clearInterval(timer);
        return;
      }
      const advancing = video.currentTime > position;
      position = video.currentTime;
      const change = prev ? lumaChange(prev, px) : Infinity;
      prev = px;
      if (detect({ at: Date.now(), luma: meanLuma(px), change, silent: audio.silent(), advancing })) {
        clearInterval(timer);
        onDeadRef.current();
      }
    }, EVERY_MS);
    return () => {
      clearInterval(timer);
      audio.close();
    };
  }, [enabled, videoRef]);
}
