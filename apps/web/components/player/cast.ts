'use client';

import { useCallback, useEffect, useState, useSyncExternalStore, type RefObject } from 'react';

// Google Cast (Chromecast, Android TV) with the Default Media Receiver: the TV fetches the stream URL itself, straight
// from the broadcaster, so nothing is proxied. Only web-playable streams are cast (they allow cross-origin playback,
// which the receiver needs). Phase 6's CSP must allow https://www.gstatic.com for the sender script.

const SENDER_SRC = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';

interface CastSession {
  loadMedia(request: unknown): Promise<unknown>;
  getCastDevice(): { friendlyName: string };
}
interface CastContext {
  setOptions(options: object): void;
  addEventListener(type: string, handler: (e: { castState?: string; sessionState?: string }) => void): void;
  removeEventListener(
    type: string,
    handler: (e: { castState?: string; sessionState?: string }) => void,
  ): void;
  requestSession(): Promise<unknown>;
  getCurrentSession(): CastSession | null;
  endCurrentSession(stopCasting: boolean): void;
  getCastState(): string;
}
interface CastGlobals {
  cast?: {
    framework: {
      CastContext: { getInstance(): CastContext };
      CastContextEventType: { CAST_STATE_CHANGED: string };
    };
  };
  chrome?: {
    cast?: {
      AutoJoinPolicy: { ORIGIN_SCOPED: string };
      Image: new (url: string) => object;
      media: {
        DEFAULT_MEDIA_RECEIVER_APP_ID: string;
        StreamType: { LIVE: string };
        MediaInfo: new (url: string, contentType: string) => { streamType?: string; metadata?: object };
        GenericMediaMetadata: new () => { title?: string; subtitle?: string; images?: object[] };
        LoadRequest: new (info: object) => { autoplay?: boolean };
      };
    };
  };
  __onGCastApiAvailable?: (available: boolean) => void;
}
const g = () => window as unknown as CastGlobals;

/** Chromium on a computer, Android or Android TV: the browsers that have a Cast sender. Not iOS (every iOS browser is Safari inside). */
export function canHaveCast(userAgent: string, hasChromeObject: boolean): boolean {
  return hasChromeObject && !/iPhone|iPad|iPod/.test(userAgent);
}

let loading: Promise<CastContext | null> | null = null;

/** Load the sender once per page and set up the context. Null where Cast isn't available. */
function loadCast(): Promise<CastContext | null> {
  loading ??= new Promise((resolve) => {
    if (!canHaveCast(navigator.userAgent, 'chrome' in window)) return resolve(null);
    g().__onGCastApiAvailable = (available) => {
      const w = g();
      if (!available || !w.cast || !w.chrome?.cast) return resolve(null);
      const context = w.cast.framework.CastContext.getInstance();
      context.setOptions({
        receiverApplicationId: w.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy: w.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
      });
      resolve(context);
    };
    const script = document.createElement('script');
    script.src = SENDER_SRC;
    script.async = true;
    script.onerror = () => resolve(null);
    document.head.append(script);
  });
  return loading;
}

export interface CastMedia {
  url: string;
  title: string;
  subtitle: string;
  logo: string | null;
}

/**
 * Cast state for the player. `enabled` once the video is playing (the sender script isn't worth loading before), and
 * `media` is what the TV should play; it is sent again when the channel changes.
 */
export function useCast(enabled: boolean, media: CastMedia | null) {
  const [context, setContext] = useState<CastContext | null>(null);
  const subscribe = useCallback(
    (onChange: () => void) => {
      const type = g().cast?.framework.CastContextEventType.CAST_STATE_CHANGED;
      if (!context || !type) return () => {};
      context.addEventListener(type, onChange);
      return () => context.removeEventListener(type, onChange);
    },
    [context],
  );
  const state = useSyncExternalStore(
    subscribe,
    () => context?.getCastState() ?? 'NO_DEVICES_AVAILABLE',
    () => 'NO_DEVICES_AVAILABLE',
  );

  useEffect(() => {
    if (!enabled || context) return;
    let live = true;
    void loadCast().then((c) => {
      if (live && c) setContext(c);
    });
    return () => {
      live = false;
    };
  }, [enabled, context]);

  // Connected: play the current channel on the TV, and again whenever the channel changes (`media` is memoized).
  const connected = state === 'CONNECTED';
  useEffect(() => {
    const session = context?.getCurrentSession();
    const api = g().chrome?.cast;
    if (!connected || !session || !media || !api) return;
    const info = new api.media.MediaInfo(media.url, 'application/x-mpegurl');
    info.streamType = api.media.StreamType.LIVE;
    const metadata = new api.media.GenericMediaMetadata();
    metadata.title = media.title;
    metadata.subtitle = media.subtitle;
    metadata.images = media.logo ? [new api.Image(media.logo)] : [];
    info.metadata = metadata;
    const request = new api.media.LoadRequest(info);
    request.autoplay = true;
    void session.loadMedia(request).catch(() => {});
  }, [connected, context, media]);

  const start = useCallback(() => void context?.requestSession().catch(() => {}), [context]);
  const stop = useCallback(() => context?.endCurrentSession(true), [context]);
  return {
    /** A Cast device is on the network (or a session is starting or running). */
    available: state !== 'NO_DEVICES_AVAILABLE' && context !== null,
    /** The TV's name while casting. */
    casting: connected ? (context?.getCurrentSession()?.getCastDevice().friendlyName ?? 'your TV') : null,
    start,
    stop,
  };
}

/** AirPlay where Safari plays the stream itself (iPhone, iPad): true while an AirPlay receiver is nearby. */
export function useAirPlay(videoRef: RefObject<HTMLVideoElement | null>, nativePlayback: boolean) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !nativePlayback || !('WebKitPlaybackTargetAvailabilityEvent' in window)) return;
    const onChange = (e: Event) =>
      setAvailable((e as Event & { availability?: string }).availability === 'available');
    video.addEventListener('webkitplaybacktargetavailabilitychanged', onChange);
    return () => {
      video.removeEventListener('webkitplaybacktargetavailabilitychanged', onChange);
      setAvailable(false);
    };
  }, [videoRef, nativePlayback]);
  const show = useCallback(
    () =>
      (
        videoRef.current as (HTMLVideoElement & { webkitShowPlaybackTargetPicker?: () => void }) | null
      )?.webkitShowPlaybackTargetPicker?.(),
    [videoRef],
  );
  return { available: available && nativePlayback, show };
}
