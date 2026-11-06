'use client';

import { useEffect, useState, type RefObject } from 'react';

export interface CaptionOption {
  /** Index in video.textTracks. */
  index: number;
  label: string;
  /** What the choice is remembered by: the language, or the label when the stream gives none. */
  key: string;
}

const isCaption = (t: TextTrack) => t.kind === 'subtitles' || t.kind === 'captions';

/** "English", from the track's label or its language code; "Track 2" when the stream says neither. */
export function trackLabel(t: { label: string; language: string }, n: number): string {
  if (t.label) return t.label;
  if (t.language) {
    try {
      return new Intl.DisplayNames(['en'], { type: 'language' }).of(t.language) ?? t.language;
    } catch {
      return t.language;
    }
  }
  return `Track ${n + 1}`;
}

/** Same base language ("en" matches "en-US" and "EN"). */
export const sameLanguage = (a: string, b: string) =>
  a.toLowerCase().split('-')[0] === b.toLowerCase().split('-')[0];

/**
 * Captions and subtitles the stream carries, as the browser lists them. hls.js mirrors its tracks (subtitle playlists
 * and CEA-608 captions) into video.textTracks and follows mode changes there, so this one list works for hls.js and
 * Safari alike. Turns the viewer's remembered language back on when a new stream offers it.
 */
export function useCaptions(videoRef: RefObject<HTMLVideoElement | null>, remembered: string | null) {
  const [state, setState] = useState<{ options: CaptionOption[]; active: number }>({
    options: [],
    active: -1,
  });
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = video.textTracks;
    const read = () => {
      const options: CaptionOption[] = [];
      let active = -1;
      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i]!;
        if (!isCaption(t)) continue;
        options.push({ index: i, label: trackLabel(t, options.length), key: t.language || t.label });
        if (t.mode === 'showing') active = i;
      }
      if (active === -1 && remembered) {
        const match = options.find((o) => sameLanguage(o.key, remembered));
        if (match) return showCaptions(video, match.index); // fires "change", which reads again
      }
      setState({ options, active });
    };
    read();
    tracks.addEventListener('addtrack', read);
    tracks.addEventListener('removetrack', read);
    tracks.addEventListener('change', read);
    return () => {
      tracks.removeEventListener('addtrack', read);
      tracks.removeEventListener('removetrack', read);
      tracks.removeEventListener('change', read);
    };
  }, [videoRef, remembered]);
  return state;
}

/** Show one caption track (-1 = none) and switch the others off. */
export function showCaptions(video: HTMLVideoElement, index: number) {
  const tracks = video.textTracks;
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i]!;
    if (isCaption(t)) t.mode = i === index ? 'showing' : 'disabled';
  }
}
