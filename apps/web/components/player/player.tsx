'use client';

import type { Channel, ChannelSummary } from '@tunely/shared';
import type Hls from 'hls.js';
import type { Events } from 'hls.js';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { sendPlaybackReport } from '@/lib/api-client';
import { attachStream, preloadHls, type PlaybackError } from '@/lib/player/attach';
import { initialPlayerState, playerReducer } from '@/lib/player/state';
import { neighbour, usePlayerStore } from '@/lib/player/store';
import { sessionId } from '@/lib/session';
import { recordWatch } from '@/lib/storage/library';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  FullscreenIcon,
  PauseIcon,
  PipIcon,
  PlayIcon,
  VolumeIcon,
} from '@/components/ui/icons';
import { PlayerOverlay } from './player-overlay';
import Link from 'next/link';

const LOAD_TIMEOUT_MS = 10_000;
const noopSubscribe = () => () => {};

// Begin fetching hls.js as soon as this module loads in the browser, in parallel with hydration.
if (typeof window !== 'undefined') void preloadHls();

interface Level {
  index: number;
  height: number;
}

export function Player({
  channel,
  fallbackLineup,
  meta,
}: {
  channel: Channel;
  fallbackLineup: ChannelSummary[];
  meta: string;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const streams = useMemo(() => channel.streams.filter((s) => s.webPlayable), [channel.streams]);
  // Nothing to try: say why instead of a generic error.
  const deadReason = streams.length
    ? undefined
    : channel.status === 'closed'
      ? 'closed'
      : channel.status === 'no_stream'
        ? 'no_stream'
        : channel.streams.some((s) => s.nativePlayable)
          ? 'browser_blocked'
          : 'offline';
  const [state, dispatch] = useReducer(playerReducer, streams.length, initialPlayerState);
  const { muted, volume, setMuted, setVolume, setLineup, lineup: storedLineup } = usePlayerStore();
  const [levels, setLevels] = useState<Level[]>([]);
  const [level, setLevel] = useState(-1);
  const [needsTap, setNeedsTap] = useState(false);
  // Lets tests (and TV remotes' first keypress) know the shortcuts are live.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const summary: ChannelSummary = useMemo(() => {
    const { streams: _s, website: _w, ...rest } = channel;
    return rest;
  }, [channel]);

  const lineup = useMemo(() => {
    if (storedLineup.some((c) => c.id === channel.id)) return storedLineup;
    return [summary, ...fallbackLineup];
  }, [storedLineup, channel.id, summary, fallbackLineup]);

  const go = useCallback(
    (step: 1 | -1) => {
      const id = neighbour(lineup, channel.id, step);
      if (!id) return;
      // Keep walking the same list on the next page, even if it was the related-channels fallback.
      setLineup(lineup);
      router.push(`/watch/${encodeURIComponent(id)}`);
    },
    [lineup, channel.id, router, setLineup],
  );

  // New channel (the player stays mounted so fullscreen survives channel up/down): reset the state machine.
  const firstChannel = useRef(channel.id);
  useEffect(() => {
    if (firstChannel.current === channel.id) return;
    firstChannel.current = channel.id;
    setNeedsTap(false);
    dispatch({ type: 'channel', streamCount: streams.length });
  }, [channel.id, streams.length]);

  // Attach the current stream. Re-runs on every attempt; the cleanup destroys the hls instance,
  // so switching channels never leaks a player.
  const stream =
    state.status === 'loading' || state.status === 'playing' || state.status === 'paused'
      ? streams[state.streamIndex]
      : undefined;
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    let cancelled = false;
    let reported = false;
    let attached: { destroy(): void } | null = null;
    const started = performance.now();
    const report = (result: 'ok' | 'error', errorType: PlaybackError | null = null) => {
      if (reported) return;
      reported = true;
      sendPlaybackReport({
        streamId: stream.id,
        platform: 'web',
        result,
        errorType,
        ttffMs: result === 'ok' ? Math.round(performance.now() - started) : null,
        sessionId: sessionId(),
      });
    };
    const fail = (error: PlaybackError) => {
      if (cancelled) return;
      report('error', error);
      dispatch({ type: 'error', error });
    };
    const timer = setTimeout(() => fail('timeout'), LOAD_TIMEOUT_MS);
    const onPlaying = () => {
      clearTimeout(timer);
      report('ok');
      dispatch({ type: 'playing' });
      void recordWatch(summary);
    };
    video.addEventListener('playing', onPlaying);

    void attachStream(video, stream.url, {
      onError: fail,
      onReady: (hls) => {
        hlsRef.current = hls;
        if (hls) {
          hls.on('hlsManifestParsed' as Events.MANIFEST_PARSED, () => {
            const seen = new Set<number>();
            setLevels(
              hls.levels
                .map((l, index) => ({ index, height: l.height }))
                .filter((l) => l.height && !seen.has(l.height) && seen.add(l.height))
                .sort((a, b) => b.height - a.height),
            );
          });
          hls.on('hlsLevelSwitched' as Events.LEVEL_SWITCHED, () =>
            setLevel(hls.autoLevelEnabled ? -1 : hls.currentLevel),
          );
        }
      },
    }).then((a) => {
      attached = a;
      if (cancelled) return a.destroy();
      video.play().catch((err: Error) => {
        // Autoplay with sound is blocked until the viewer interacts: start muted instead.
        if (err.name === 'NotAllowedError' && !cancelled) {
          video.muted = true;
          setNeedsTap(true);
          void video.play().catch(() => {});
        }
      });
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      video.removeEventListener('playing', onPlaying);
      attached?.destroy();
      hlsRef.current = null;
      setLevels([]);
      setLevel(-1);
    };
    // state.attempt forces a fresh attach on retry even when the stream is the same.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream?.id, state.attempt]);

  // Count watch time for "Continue watching".
  useEffect(() => {
    if (state.status !== 'playing') return;
    const since = Date.now();
    return () => void recordWatch(summary, (Date.now() - since) / 1000);
  }, [state.status, summary]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.muted = muted || needsTap;
  }, [muted, volume, needsTap]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  }, []);
  const toggleMute = useCallback(() => {
    if (needsTap) {
      setNeedsTap(false);
      setMuted(false);
    } else setMuted(!muted);
  }, [needsTap, muted, setMuted]);
  const toggleFullscreen = useCallback(() => {
    const el = frameRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (el.requestFullscreen) void el.requestFullscreen();
    // iOS Safari only supports fullscreen on the video element itself.
    else
      (
        videoRef.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void }
      )?.webkitEnterFullscreen?.();
  }, []);
  const togglePip = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) void document.exitPictureInPicture();
    else void v.requestPictureInPicture?.().catch(() => {});
  }, []);

  // Shortcuts: arrows = channel up/down, F = fullscreen, M = mute, Space/K = pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable], dialog')) return;
      const isButton = t.closest('button, a');
      switch (e.key) {
        case 'ArrowUp':
        case 'PageUp':
        case 'ChannelUp':
          e.preventDefault();
          return go(-1);
        case 'ArrowDown':
        case 'PageDown':
        case 'ChannelDown':
          e.preventDefault();
          return go(1);
        case 'f':
        case 'F':
          return toggleFullscreen();
        case 'm':
        case 'M':
          return toggleMute();
        case ' ':
        case 'k':
        case 'K':
          if (e.key === ' ' && isButton) return; // Space activates the focused control instead.
          e.preventDefault();
          return togglePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, toggleFullscreen, toggleMute, togglePlay]);

  const playing = state.status === 'playing';
  const currentHeight = levels.find((l) => l.index === level)?.height;
  const btn =
    'flex size-11 items-center justify-center rounded-[8px] text-[#F2F4F8] hover:bg-white/10 sm:size-12';

  return (
    <section aria-label={`${channel.name} player`} className="relative" data-hydrated={hydrated || undefined}>
      <div
        ref={frameRef}
        className="relative aspect-video w-full overflow-hidden bg-black min-[720px]:rounded-none"
      >
        <video
          ref={videoRef}
          playsInline
          className="absolute inset-0 size-full"
          onPause={() => dispatch({ type: 'paused' })}
          onPlay={() => state.status === 'paused' && dispatch({ type: 'playing' })}
          onDoubleClick={toggleFullscreen}
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/70 to-transparent"
        />
        <div className="absolute inset-x-4 top-4 flex items-center gap-3.5 sm:inset-x-8 sm:top-6">
          <Link
            href="/"
            aria-label="Back to home"
            className="flex size-11 items-center justify-center rounded-full bg-white/15 text-[#F2F4F8]"
          >
            <ChevronLeft size={20} />
          </Link>
          <div className="invisible min-w-0 grow text-[#F2F4F8] sm:visible">
            <div className="truncate text-lg font-bold">{channel.name}</div>
            <div className="truncate text-[13px] text-[#C9D0DD]">{meta}</div>
          </div>
          <span className="bg-live rounded-[6px] px-2.5 py-[5px] text-xs font-extrabold tracking-[0.08em] text-[#0B0D12]">
            LIVE
          </span>
        </div>

        <PlayerOverlay
          status={state.status}
          error={state.error}
          channelName={channel.name}
          onNext={() => go(1)}
          onRetry={() => dispatch({ type: 'retry' })}
          canGoNext={lineup.length > 1}
          deadReason={deadReason}
        />

        {needsTap && playing && (
          <button
            type="button"
            onClick={toggleMute}
            className="bg-surface-raised text-text absolute top-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-2.5 text-sm font-semibold sm:top-24"
          >
            Tap to unmute
          </button>
        )}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/80 to-transparent"
        />
        <div className="absolute inset-x-1 bottom-1 flex items-center gap-0 sm:inset-x-6 sm:bottom-5 sm:gap-1.5">
          <button type="button" className={btn} onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <PauseIcon size={26} /> : <PlayIcon size={24} />}
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => go(-1)}
            aria-label="Previous channel"
            disabled={lineup.length < 2}
          >
            <ChevronUp />
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => go(1)}
            aria-label="Next channel"
            disabled={lineup.length < 2}
          >
            <ChevronDown />
          </button>
          <button
            type="button"
            className={btn}
            onClick={toggleMute}
            aria-label={muted || needsTap ? 'Unmute' : 'Mute'}
          >
            <VolumeIcon muted={muted || needsTap} />
          </button>
          <label htmlFor="player-volume" className="sr-only">
            Volume
          </label>
          <input
            id="player-volume"
            type="range"
            min={0}
            max={100}
            value={Math.round((muted ? 0 : volume) * 100)}
            onChange={(e) => {
              setNeedsTap(false);
              setVolume(Number(e.target.value) / 100);
            }}
            className="hidden w-28 accent-[#F2F4F8] sm:block"
          />
          <span className="hidden items-center gap-1.5 pl-3 text-sm font-bold text-[#F2F4F8] sm:flex">
            <span aria-hidden="true" className="bg-live size-2 rounded-full" />
            Live
          </span>
          <span className="grow" />
          {levels.length > 1 && (
            <>
              <label htmlFor="player-quality" className="sr-only">
                Quality
              </label>
              <select
                id="player-quality"
                value={level}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (hlsRef.current) hlsRef.current.currentLevel = next;
                  setLevel(next);
                }}
                className="h-10 max-w-[104px] rounded-[8px] bg-white/15 px-2 text-sm font-semibold text-[#F2F4F8] sm:max-w-none sm:px-3 [&>option]:text-black"
              >
                <option value={-1}>Auto{level === -1 && currentHeight ? ` · ${currentHeight}p` : ''}</option>
                {levels.map((l) => (
                  <option key={l.index} value={l.index}>
                    {l.height}p
                  </option>
                ))}
              </select>
            </>
          )}
          <button
            type="button"
            className={`${btn} hidden sm:flex`}
            onClick={togglePip}
            aria-label="Picture in picture"
          >
            <PipIcon />
          </button>
          <button type="button" className={btn} onClick={toggleFullscreen} aria-label="Fullscreen">
            <FullscreenIcon />
          </button>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {state.status === 'loading'
          ? `Loading ${channel.name}`
          : state.status === 'error'
            ? `${channel.name} is unavailable`
            : ''}
      </p>
    </section>
  );
}
