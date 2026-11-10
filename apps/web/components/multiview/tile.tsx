'use client';

import type { Channel } from '@tunely/shared';
import type Hls from 'hls.js';
import type { Events } from 'hls.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { sendPlaybackReport } from '@/lib/api-client';
import { attachStream, type PlaybackError } from '@/lib/player/attach';
import { capLevel } from '@/lib/player/store';
import { sessionId, visitorAge } from '@/lib/session';
import { cn } from '@/lib/utils';

/** Each tile is small: 480p is plenty and keeps four streams within a normal connection. */
const TILE_HEIGHT = 480;
const LOAD_TIMEOUT_MS = 20_000;

export interface TileProps {
  channel: Channel;
  /** This tile's sound is on; the others are muted. */
  audio: boolean;
  onAudio(): void;
  onChange(): void;
  onRemove(): void;
}

/** One small player: verified streams in order, a playback report per attempt. Keyed by channel id: a new channel is
 * a new tile, and unmounting destroys the hls instance. */
export function Tile({ channel, audio, onAudio, onChange, onRemove }: TileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streams = useMemo(() => channel.streams.filter((s) => s.webPlayable && s.score >= 50), [channel.streams]);
  const [index, setIndex] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const stream = streams[index];
  const state = !stream ? 'error' : playingId === stream.id ? 'playing' : 'loading';

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
      setIndex((i) => i + 1); // the next stream, or "can't play" when none is left
    };
    const timer = setTimeout(() => fail('timeout'), LOAD_TIMEOUT_MS);
    const onPlaying = () => {
      clearTimeout(timer);
      report('ok');
      setPlayingId(stream.id);
    };
    video.addEventListener('playing', onPlaying);
    void attachStream(video, stream.url, {
      onError: fail,
      onReady: (hls: Hls | null) => {
        hls?.on('hlsManifestParsed' as Events.MANIFEST_PARSED, () => {
          if (hls.levels.length > 1) hls.autoLevelCapping = capLevel(hls.levels, TILE_HEIGHT);
        });
      },
    }).then((a) => {
      attached = a;
      if (cancelled) return a.destroy();
      void video.play().catch(() => {});
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      video.removeEventListener('playing', onPlaying);
      attached?.destroy();
    };
  }, [stream]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = !audio;
  }, [audio]);

  const btn = 'h-9 rounded-[8px] bg-black/60 px-3 text-[13px] font-semibold text-[#F2F4F8] hover:bg-black/80';
  return (
    <section
      aria-label={channel.name}
      className={cn(
        'relative aspect-video overflow-hidden rounded-[12px] bg-black',
        audio && 'ring-accent ring-2 ring-offset-2 ring-offset-[var(--bg)]',
      )}
    >
      {/* Muted until chosen, so autoplay is allowed. */}
      <video ref={videoRef} playsInline muted className="absolute inset-0 size-full" />
      <div className="absolute inset-x-2 top-2 flex items-center gap-2">
        <span className="min-w-0 grow truncate rounded-[6px] bg-black/60 px-2 py-1 text-[13px] font-semibold text-[#F2F4F8]">
          {channel.name}
        </span>
        <button type="button" onClick={onChange} className={btn}>
          Change
        </button>
        <button type="button" onClick={onRemove} aria-label={`Remove ${channel.name}`} className={btn}>
          ✕
        </button>
      </div>
      <button
        type="button"
        onClick={onAudio}
        aria-pressed={audio}
        className={cn(btn, 'absolute bottom-2 left-2')}
      >
        {audio ? 'Sound on' : 'Listen'}
      </button>
      {state !== 'playing' && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-[15px] text-[#C9D0DD]">
          {state === 'loading' ? 'Tuning in…' : `${channel.name} can't play here right now.`}
        </p>
      )}
    </section>
  );
}
