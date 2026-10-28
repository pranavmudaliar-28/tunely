'use client';

import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { cn } from '@/lib/utils';

// Live streams have no fixed duration: the "timeline" is the window of recent video the stream
// keeps (its DVR window). Position is how far into that window we are; behind = seconds from live.

/** Below this the stream keeps too little history to be worth a seek bar. */
const MIN_WINDOW_S = 30;
/** Within this many seconds of the edge counts as live. */
const LIVE_EDGE_S = 4;

export interface LiveWindow {
  seekable: boolean;
  start: number;
  end: number;
  position: number;
  behind: number;
  seekTo(t: number): void;
  goLive(): void;
}

export function useLiveWindow(videoRef: RefObject<HTMLVideoElement | null>): LiveWindow {
  const [w, setW] = useState({ start: 0, end: 0, position: 0 });

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const read = () => {
      const r = v.seekable;
      if (!r.length) return setW((p) => (p.end === 0 ? p : { start: 0, end: 0, position: 0 }));
      setW({ start: r.start(0), end: r.end(r.length - 1), position: v.currentTime });
    };
    const events = ['timeupdate', 'progress', 'durationchange', 'loadedmetadata', 'seeked', 'emptied'];
    for (const e of events) v.addEventListener(e, read);
    return () => {
      for (const e of events) v.removeEventListener(e, read);
    };
  }, [videoRef]);

  const seekTo = useCallback(
    (t: number) => {
      const v = videoRef.current;
      if (!v || !v.seekable.length) return;
      const end = v.seekable.end(v.seekable.length - 1);
      v.currentTime = Math.min(Math.max(t, v.seekable.start(0)), end - 1);
    },
    [videoRef],
  );

  return useMemo(() => {
    const seekable = w.end - w.start >= MIN_WINDOW_S;
    return {
      seekable,
      ...w,
      behind: Math.max(0, w.end - w.position),
      seekTo,
      goLive: () => seekTo(w.end),
    };
  }, [w, seekTo]);
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function LiveTimeline({ live }: { live: LiveWindow }) {
  const atLive = live.behind <= LIVE_EDGE_S;
  const span = live.end - live.start;
  const pct = span > 0 ? ((live.position - live.start) / span) * 100 : 100;
  return (
    <div className="flex items-center gap-3 px-2 text-[#F2F4F8]">
      <label htmlFor="player-seek" className="sr-only">
        Rewind live stream
      </label>
      <input
        id="player-seek"
        type="range"
        min={live.start}
        max={live.end}
        step={1}
        value={live.position}
        onChange={(e) => live.seekTo(Number(e.target.value))}
        aria-valuetext={atLive ? 'Live' : `${formatClock(live.behind)} behind live`}
        className="seek h-6 grow cursor-pointer"
        style={{ '--seek-pct': `${pct}%` } as React.CSSProperties}
      />
      <span className="min-w-[4.5rem] text-right text-sm font-semibold tabular-nums">
        {atLive ? '' : `-${formatClock(live.behind)}`}
      </span>
      <button
        type="button"
        onClick={live.goLive}
        aria-label={atLive ? 'Playing live' : 'Go to live'}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-extrabold tracking-[0.08em]',
          atLive ? 'text-[#F2F4F8]' : 'bg-white/15 text-[#C9D0DD] hover:bg-white/25',
        )}
      >
        <span aria-hidden="true" className={cn('size-2 rounded-full', atLive ? 'bg-live' : 'bg-[#9AA3B5]')} />
        LIVE
      </button>
    </div>
  );
}

/** Circular-arrow "10" button, like the browser's picture-in-picture controls. */
export function SkipButton({
  seconds,
  onClick,
  className,
  disabled,
}: {
  seconds: number;
  onClick(): void;
  className?: string;
  disabled?: boolean;
}) {
  const back = seconds < 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={back ? `Back ${-seconds} seconds` : `Forward ${seconds} seconds`}
      className={cn(className, 'disabled:opacity-40')}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d={back ? 'M4 12a8 8 0 1 0 2.3-5.6M4 3v4h4' : 'M20 12a8 8 0 1 1-2.3-5.6M20 3v4h-4'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="12" y="15.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor">
          {Math.abs(seconds)}
        </text>
      </svg>
    </button>
  );
}
