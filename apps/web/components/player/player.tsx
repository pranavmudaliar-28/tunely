'use client';

import type { Channel, ChannelSummary } from '@tunely/shared';
import type Hls from 'hls.js';
import type { Events } from 'hls.js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { sendPlaybackReport } from '@/lib/api-client';
import { attachStream, type PlaybackError } from '@/lib/player/attach';
import { DOUBLE_TAP_MS, swipeDirection, tapSide } from '@/lib/player/gestures';
import { initialPlayerState, playerReducer } from '@/lib/player/state';
import { capLevel, neighbour, preferredLevel, usePlayerStore } from '@/lib/player/store';
import { DATA_SAVER_HEIGHT, dataSaverOn, getPrefs } from '@/lib/prefs';
import { sessionId, visitorAge } from '@/lib/session';
import { recordWatch, useLibrary } from '@/lib/storage/library';
import { cn } from '@/lib/utils';
import {
  AirPlayIcon,
  CastIcon,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  CloseIcon,
  FullscreenIcon,
  ListIcon,
  PauseIcon,
  PipIcon,
  PlayIcon,
  VolumeIcon,
} from '@/components/ui/icons';
import { useAirPlay, useCast } from './cast';
import { ChannelList } from './channel-list';
import { PlayerOverlay } from './player-overlay';
import { openShortcuts, ShortcutsDialog } from './shortcuts';
import { LiveTimeline, SkipButton, useLiveWindow } from './timeline';
import { showCaptions, useCaptions } from './tracks';

/** The browser's connection hints (Chrome and Android only); absent elsewhere. */
const connection = () =>
  (navigator as Navigator & { connection?: { saveData?: boolean; type?: string } }).connection;

interface AudioOption {
  index: number;
  label: string;
}

const LOAD_TIMEOUT_MS = 10_000;
/** Controls fade out after this long without mouse, touch or keyboard input while playing. */
const IDLE_MS = 3000;
const noopSubscribe = () => () => {};

interface Level {
  index: number;
  height: number;
}

export type PlayerMode = 'full' | 'mini';

export function Player({
  channel,
  fallbackLineup,
  meta,
  mode = 'full',
  onClose,
}: {
  channel: Channel;
  fallbackLineup: ChannelSummary[];
  meta: string;
  /** full: the watch page. mini: docked in a corner while browsing other pages. */
  mode?: PlayerMode;
  onClose?(): void;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const full = mode === 'full';
  // Verified by our checker (or by viewers): tried automatically, best first.
  const verified = useMemo(
    () => channel.streams.filter((s) => s.webPlayable && s.score >= 50),
    [channel.streams],
  );
  // Not verified, but a viewer's browser may still play them (e.g. limited to the viewer's country, or
  // blocking our server). Only ones a browser can load at all: HTTPS on an HTTPS page, no special headers.
  const unverified = useMemo(
    () =>
      channel.streams.filter(
        (s) =>
          !(s.webPlayable && s.score >= 50) && s.url.startsWith('https://') && !s.referrer && !s.userAgent,
      ),
    [channel.streams],
  );
  const [trying, setTrying] = useState(false);
  const streams = trying ? unverified : verified;
  // Nothing to try: say why instead of a generic error.
  const deadReason =
    streams.length || trying
      ? undefined
      : channel.status === 'closed'
        ? 'closed'
        : channel.status === 'no_stream'
          ? 'no_stream'
          : channel.streams.some((s) => s.nativePlayable)
            ? 'browser_blocked'
            : 'offline';
  const [state, dispatch] = useReducer(playerReducer, streams.length, initialPlayerState);
  const {
    muted,
    volume,
    captions: rememberedCaptions,
    previous,
    setMuted,
    setVolume,
    setQuality,
    setCaptions,
    setLineup,
    setPrevious,
    lineup: storedLineup,
  } = usePlayerStore();
  const { favorites } = useLibrary();
  const [levels, setLevels] = useState<Level[]>([]);
  const [level, setLevel] = useState(-1);
  const [saver, setSaver] = useState(false);
  /** The browser plays the stream itself (Safari, iOS): AirPlay works then. */
  const [native, setNative] = useState(false);
  const [audio, setAudio] = useState<{ options: AudioOption[]; active: number }>({ options: [], active: -1 });
  const [needsTap, setNeedsTap] = useState(false);
  const [idle, setIdle] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [fill, setFill] = useState(false);
  const fullscreen = useIsFullscreen(frameRef);
  const live = useLiveWindow(videoRef);
  const captions = useCaptions(videoRef, rememberedCaptions);
  const listButton = useRef<HTMLButtonElement>(null);
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

  /** Open a channel; up/down then walks `list` (by default the current one, even the related-channels fallback). */
  const open = useCallback(
    (id: string, list: Pick<ChannelSummary, 'id' | 'name' | 'status'>[] = lineup) => {
      setLineup(list);
      router.push(`/watch/${encodeURIComponent(id)}`);
    },
    [lineup, router, setLineup],
  );
  const go = useCallback(
    (step: 1 | -1) => {
      const id = neighbour(lineup, channel.id, step);
      if (id) open(id);
    },
    [lineup, channel.id, open],
  );

  // Faster switching: fetch the next and previous channels' pages while this one plays.
  const playingNow = state.status === 'playing';
  useEffect(() => {
    if (!full || !playingNow) return;
    for (const step of [1, -1] as const) {
      const id = neighbour(lineup, channel.id, step);
      if (id) router.prefetch(`/watch/${encodeURIComponent(id)}`);
    }
  }, [full, playingNow, lineup, channel.id, router]);

  // Lock screen, notification and headset buttons: channel name and logo; previous/next change channel.
  const canZap = lineup.length > 1;
  useEffect(() => {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    const session = navigator.mediaSession;
    session.metadata = new MediaMetadata({
      title: channel.name,
      artist: meta,
      artwork: channel.logo ? [{ src: channel.logo }] : [],
    });
    const actions: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      ['previoustrack', canZap ? () => go(-1) : null],
      ['nexttrack', canZap ? () => go(1) : null],
    ];
    const set = (handler: (h: MediaSessionActionHandler | null) => MediaSessionActionHandler | null) =>
      actions.forEach(([action, h]) => {
        try {
          session.setActionHandler(action, handler(h));
        } catch {
          // Older browsers throw for actions they don't know.
        }
      });
    set((h) => h);
    return () => set(() => null);
  }, [channel.name, channel.logo, meta, canZap, go]);

  // New channel (the player stays mounted so fullscreen and picture-in-picture survive): reset.
  const lastChannel = useRef({ id: channel.id, name: channel.name });
  useEffect(() => {
    if (lastChannel.current.id === channel.id) return;
    setPrevious(lastChannel.current); // for "last channel" (L)
    lastChannel.current = { id: channel.id, name: channel.name };
    setNeedsTap(false);
    setTrying(false);
    setListOpen(false);
    dispatch({ type: 'channel', streamCount: verified.length });
  }, [channel.id, channel.name, verified.length, setPrevious]);

  const tryAnyway = useCallback(() => {
    setTrying(true);
    dispatch({ type: 'channel', streamCount: unverified.length });
  }, [unverified.length]);

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
        visitorAge: visitorAge(),
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
        setNative(hls === null);
        if (hls) {
          hls.on('hlsManifestParsed' as Events.MANIFEST_PARSED, () => {
            const seen = new Set<number>();
            const list = hls.levels
              .map((l, index) => ({ index, height: l.height }))
              .filter((l) => l.height && !seen.has(l.height) && seen.add(l.height))
              .sort((a, b) => b.height - a.height);
            setLevels(list);
            // Data saver caps Auto, and a remembered quality above the cap.
            const saving = dataSaverOn(getPrefs().dataSaver, connection());
            setSaver(saving);
            if (saving && hls.levels.length > 1)
              hls.autoLevelCapping = capLevel(hls.levels, DATA_SAVER_HEIGHT);
            const quality = usePlayerStore.getState().quality;
            const pick = preferredLevel(
              list,
              saving && quality ? Math.min(quality, DATA_SAVER_HEIGHT) : quality,
            );
            if (pick !== -1) hls.currentLevel = pick;
          });
          hls.on('hlsLevelSwitched' as Events.LEVEL_SWITCHED, () =>
            setLevel(hls.autoLevelEnabled ? -1 : hls.currentLevel),
          );
          const readAudio = () =>
            setAudio({
              options: hls.audioTracks.map((t, index) => ({
                index,
                label: t.name || t.lang || `Audio ${index + 1}`,
              })),
              active: hls.audioTrack,
            });
          hls.on('hlsAudioTracksUpdated' as Events.AUDIO_TRACKS_UPDATED, readAudio);
          hls.on('hlsAudioTrackSwitched' as Events.AUDIO_TRACK_SWITCHED, readAudio);
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
      setSaver(false);
      setNative(false);
      setAudio({ options: [], active: -1 });
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
    // Phones turn sideways like YouTube (Android Chrome; desktops reject the lock, which is fine).
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (o: 'landscape') => Promise<void>;
    };
    if (document.fullscreenElement) {
      orientation.unlock?.();
      void document.exitFullscreen();
    } else if (el.requestFullscreen)
      void el
        .requestFullscreen()
        .then(() => orientation.lock?.('landscape'))
        .catch(() => {});
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
  const seekBy = useCallback((seconds: number) => live.seekTo(live.position + seconds), [live]);

  // Controls hide while watching and come back on any mouse, touch or keyboard input.
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wake = useCallback(() => {
    setIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS);
  }, []);
  // Start the idle countdown as soon as video plays, not only after the first mouse move.
  useEffect(() => {
    if (state.status !== 'playing') return;
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS);
    return () => clearTimeout(idleTimer.current);
  }, [state.status]);
  const controlsHidden = full && idle && state.status === 'playing' && !listOpen;

  const closeList = useCallback(() => {
    setListOpen(false);
    listButton.current?.focus();
  }, []);
  const lastOpened = useCallback(() => {
    if (previous && previous.id !== channel.id) open(previous.id);
  }, [previous, channel.id, open]);
  const openFavorite = useCallback(
    (n: number) => {
      const fav = favorites[n];
      if (fav && fav.id !== channel.id) open(fav.id, favorites);
    },
    [favorites, channel.id, open],
  );

  // Phones in fullscreen: swipe up/down to change channel, double-tap a side to skip 10 s.
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastTap = useRef<{ t: number; side: string } | null>(null);
  const onTouchStart = (e: React.PointerEvent) => {
    const onControl = (e.target as HTMLElement).closest('button, a, input, select, nav');
    touch.current =
      fullscreen && e.pointerType === 'touch' && !onControl
        ? { x: e.clientX, y: e.clientY, t: e.timeStamp }
        : null;
  };
  const onTouchEnd = (e: React.PointerEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || !frameRef.current) return;
    const swipe = swipeDirection(e.clientX - start.x, e.clientY - start.y, e.timeStamp - start.t);
    if (swipe) return go(swipe === 'up' ? 1 : -1);
    const rect = frameRef.current.getBoundingClientRect();
    const side = tapSide(e.clientX - rect.left, rect.width);
    const prev = lastTap.current;
    lastTap.current = { t: e.timeStamp, side };
    if (
      prev &&
      prev.side === side &&
      side !== 'center' &&
      e.timeStamp - prev.t < DOUBLE_TAP_MS &&
      live.seekable
    ) {
      lastTap.current = null;
      seekBy(side === 'left' ? -10 : 10);
    }
  };

  // Shortcuts (watch page only): arrows = channel up/down, ←/→ = 10 s, F, M, Space/K, G list, L last, 1–9, ?.
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable], dialog')) return;
      const isButton = t.closest('button, a');
      wake();
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
        case 'ArrowLeft':
          if (!live.seekable || isButton) return;
          e.preventDefault();
          return seekBy(-10);
        case 'ArrowRight':
          if (!live.seekable || isButton) return;
          e.preventDefault();
          return seekBy(10);
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
        case 'g':
        case 'G':
          return setListOpen((o) => !o);
        case 'l':
        case 'L':
          return lastOpened();
        case '?':
          return openShortcuts();
      }
      if (/^[1-9]$/.test(e.key)) openFavorite(Number(e.key) - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    full,
    go,
    toggleFullscreen,
    toggleMute,
    togglePlay,
    seekBy,
    live.seekable,
    wake,
    lastOpened,
    openFavorite,
  ]);

  // Cast to a TV: only a verified stream (it allows cross-origin playback, which the receiver needs).
  const castMedia = useMemo(
    () =>
      stream && !trying ? { url: stream.url, title: channel.name, subtitle: meta, logo: channel.logo } : null,
    [stream, trying, channel.name, meta, channel.logo],
  );
  const cast = useCast(full && state.status === 'playing', castMedia);
  const airplay = useAirPlay(videoRef, native);
  // The TV plays it now: pause here, and pick up again (at live) when casting stops.
  const wasCasting = useRef(false);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (cast.casting) v.pause();
    else if (wasCasting.current) void v.play().catch(() => {});
    wasCasting.current = Boolean(cast.casting);
  }, [cast.casting, stream?.id]);

  const playing = state.status === 'playing';
  const currentHeight = levels.find((l) => l.index === level)?.height;
  const btn = cn(
    'flex items-center justify-center rounded-[8px] text-[#F2F4F8] hover:bg-white/10',
    full ? 'size-11 sm:size-12' : 'size-10',
  );
  const fade = cn('transition-opacity duration-300', controlsHidden && 'pointer-events-none opacity-0');

  return (
    <section
      aria-label={`${channel.name} player`}
      className="relative"
      data-hydrated={hydrated || undefined}
      data-mode={mode}
    >
      <div
        ref={frameRef}
        onPointerMove={wake}
        onPointerDown={(e) => {
          wake();
          onTouchStart(e);
        }}
        onPointerUp={onTouchEnd}
        onPointerCancel={() => (touch.current = null)}
        onFocus={wake}
        className={cn(
          'relative aspect-video w-full overflow-hidden bg-black',
          controlsHidden && 'cursor-none',
          // Fullscreen swipes are ours, not the browser's (no scroll or pull-to-refresh).
          fullscreen && 'touch-none',
        )}
      >
        <video
          ref={videoRef}
          playsInline
          className={cn('absolute inset-0 size-full', fill && fullscreen && 'object-cover')}
          onPause={() => dispatch({ type: 'paused' })}
          onPlay={() => state.status === 'paused' && dispatch({ type: 'playing' })}
          onDoubleClick={full ? toggleFullscreen : undefined}
        />

        {full ? (
          <>
            <div
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/70 to-transparent',
                fade,
              )}
            />
            <div
              className={cn('absolute inset-x-4 top-4 flex items-center gap-3.5 sm:inset-x-8 sm:top-6', fade)}
            >
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
          </>
        ) : (
          <div className="absolute inset-x-2 top-2 flex items-center gap-2">
            <Link
              href={`/watch/${encodeURIComponent(channel.id)}`}
              className="min-w-0 grow truncate rounded-[6px] bg-black/60 px-2 py-1 text-[13px] font-semibold text-[#F2F4F8] no-underline"
              aria-label={`Open ${channel.name}`}
            >
              {channel.name}
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close player"
              className="flex size-9 items-center justify-center rounded-full bg-black/60 text-[#F2F4F8]"
            >
              <CloseIcon size={18} />
            </button>
          </div>
        )}

        <PlayerOverlay
          status={state.status}
          error={state.error}
          channelName={channel.name}
          onNext={() => go(1)}
          onRetry={() => dispatch({ type: 'retry' })}
          canGoNext={full && lineup.length > 1}
          deadReason={deadReason}
          onTryAnyway={!trying && unverified.length ? tryAnyway : undefined}
          successor={channel.replacedBy}
          compact={!full}
        />

        {full && listOpen && (
          <ChannelList
            items={lineup}
            currentId={channel.id}
            onClose={closeList}
            onPick={(id) => {
              setListOpen(false);
              if (id !== channel.id) open(id);
            }}
          />
        )}
        <SwipeHint show={fullscreen && lineup.length > 1} />
        {cast.casting && (
          <div
            role="status"
            className="bg-surface text-text absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
          >
            <CastIcon size={36} className="text-text-muted" />
            <p className="text-base font-semibold">
              {channel.name} is playing on {cast.casting}
            </p>
            <button
              type="button"
              onClick={cast.stop}
              className="border-border bg-surface-raised h-11 rounded-[8px] border px-[18px] text-sm font-semibold"
            >
              Stop casting
            </button>
          </div>
        )}

        {needsTap && playing && (
          <button
            type="button"
            onClick={toggleMute}
            className="bg-surface-raised text-text absolute top-14 left-1/2 -translate-x-1/2 rounded-full px-4 py-2.5 text-sm font-semibold sm:top-24"
          >
            Tap to unmute
          </button>
        )}

        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent',
            full ? 'h-48' : 'h-20',
            fade,
          )}
        />
        <div
          className={cn(
            'absolute flex flex-col',
            full ? 'inset-x-1 bottom-1 gap-1 sm:inset-x-6 sm:bottom-4' : 'inset-x-1 bottom-0.5',
            fade,
          )}
        >
          {full && live.seekable && <LiveTimeline live={live} />}
          <div className={cn('flex items-center', full ? 'gap-0 sm:gap-1.5' : 'gap-0')}>
            <button
              type="button"
              className={btn}
              onClick={togglePlay}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? <PauseIcon size={full ? 26 : 22} /> : <PlayIcon size={full ? 24 : 20} />}
            </button>
            {full && live.seekable && (
              <>
                <SkipButton seconds={-10} onClick={() => seekBy(-10)} className={btn} />
                <SkipButton
                  seconds={10}
                  onClick={() => seekBy(10)}
                  className={btn}
                  disabled={live.behind < 1}
                />
              </>
            )}
            {full && (
              <>
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
                  ref={listButton}
                  type="button"
                  className={btn}
                  onClick={() => setListOpen((o) => !o)}
                  aria-label="Channel list"
                  aria-expanded={listOpen}
                  disabled={lineup.length < 2}
                >
                  <ListIcon />
                </button>
              </>
            )}
            <button
              type="button"
              className={btn}
              onClick={toggleMute}
              aria-label={muted || needsTap ? 'Unmute' : 'Mute'}
            >
              <VolumeIcon muted={muted || needsTap} size={full ? 22 : 20} />
            </button>
            {full && (
              <>
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
                {!live.seekable && (
                  <span className="hidden items-center gap-1.5 pl-3 text-sm font-bold text-[#F2F4F8] sm:flex">
                    <span aria-hidden="true" className="bg-live size-2 rounded-full" />
                    Live
                  </span>
                )}
              </>
            )}
            <span className="grow" />
            {full && captions.options.length > 0 && (
              <>
                <label htmlFor="player-captions" className="sr-only">
                  Captions
                </label>
                <select
                  id="player-captions"
                  value={captions.active}
                  onChange={(e) => {
                    const index = Number(e.target.value);
                    if (videoRef.current) showCaptions(videoRef.current, index);
                    setCaptions(captions.options.find((o) => o.index === index)?.key ?? null);
                  }}
                  className="h-10 max-w-[96px] rounded-[8px] bg-white/15 px-2 text-sm font-semibold text-[#F2F4F8] sm:max-w-[160px] [&>option]:text-black"
                >
                  <option value={-1}>CC off</option>
                  {captions.options.map((o) => (
                    <option key={o.index} value={o.index}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </>
            )}
            {full && audio.options.length > 1 && (
              <>
                <label htmlFor="player-audio" className="sr-only">
                  Audio language
                </label>
                <select
                  id="player-audio"
                  value={audio.active}
                  onChange={(e) => {
                    if (hlsRef.current) hlsRef.current.audioTrack = Number(e.target.value);
                  }}
                  className="h-10 max-w-[96px] rounded-[8px] bg-white/15 px-2 text-sm font-semibold text-[#F2F4F8] sm:max-w-[160px] [&>option]:text-black"
                >
                  {audio.options.map((o) => (
                    <option key={o.index} value={o.index}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </>
            )}
            {full && levels.length > 1 && (
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
                    setQuality(levels.find((l) => l.index === next)?.height ?? null);
                  }}
                  className="h-10 max-w-[104px] rounded-[8px] bg-white/15 px-2 text-sm font-semibold text-[#F2F4F8] sm:max-w-none sm:px-3 [&>option]:text-black"
                >
                  <option value={-1}>
                    Auto{level === -1 && currentHeight ? ` · ${currentHeight}p` : ''}
                    {saver ? ' · data saver' : ''}
                  </option>
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
              className={cn(btn, full && 'hidden sm:flex')}
              onClick={togglePip}
              aria-label="Picture in picture"
            >
              <PipIcon size={full ? 22 : 20} />
            </button>
            {full && cast.available && (
              <button
                type="button"
                className={btn}
                onClick={cast.casting ? cast.stop : cast.start}
                aria-label={cast.casting ? `Stop casting to ${cast.casting}` : 'Cast to TV'}
                aria-pressed={Boolean(cast.casting)}
              >
                <CastIcon />
              </button>
            )}
            {full && airplay.available && (
              <button type="button" className={btn} onClick={airplay.show} aria-label="AirPlay">
                <AirPlayIcon />
              </button>
            )}
            {fullscreen && (
              <button
                type="button"
                className={cn(btn, 'w-auto px-3 text-sm font-semibold')}
                onClick={() => setFill((f) => !f)}
                aria-pressed={fill}
              >
                {fill ? 'Fit' : 'Fill'}
              </button>
            )}
            {full ? (
              <button type="button" className={btn} onClick={toggleFullscreen} aria-label="Fullscreen">
                <FullscreenIcon />
              </button>
            ) : (
              <Link
                href={`/watch/${encodeURIComponent(channel.id)}`}
                className={btn}
                aria-label={`Expand ${channel.name}`}
              >
                <FullscreenIcon size={20} />
              </Link>
            )}
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {state.status === 'loading'
          ? `Loading ${channel.name}`
          : state.status === 'error'
            ? `${channel.name} is unavailable`
            : ''}
      </p>
      {full && <ShortcutsDialog />}
    </section>
  );
}

/** True while `ref` is the fullscreen element (not on iOS, which only fullscreens the <video> itself). */
function useIsFullscreen(ref: React.RefObject<HTMLElement | null>) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const update = () => setOn(document.fullscreenElement === ref.current && ref.current !== null);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, [ref]);
  return on;
}

const SWIPE_HINT_KEY = 'tunely.hint.swipe';

/** Once per browser, the first time a touch screen goes fullscreen: says that swiping changes channel. */
function SwipeHint({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!show || !matchMedia('(pointer: coarse)').matches) return;
    try {
      if (localStorage.getItem(SWIPE_HINT_KEY)) return;
      localStorage.setItem(SWIPE_HINT_KEY, '1');
    } catch {
      return; // can't remember it: don't nag every time
    }
    const on = setTimeout(() => setVisible(true), 0);
    const off = setTimeout(() => setVisible(false), 4000);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [show]);
  if (!visible || !show) return null;
  return (
    <p
      role="status"
      className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/75 px-4 py-2.5 text-sm font-semibold text-[#F2F4F8]"
    >
      Swipe up or down to change channel
    </p>
  );
}
