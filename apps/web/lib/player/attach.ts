import type Hls from 'hls.js';
import type { ErrorData } from 'hls.js';

export type PlaybackError =
  'offline' | 'geo_blocked' | 'browser_blocked' | 'unsupported_codec' | 'timeout' | 'media' | 'unknown';

export interface Attached {
  destroy(): void;
}

export interface AttachOptions {
  onError(type: PlaybackError): void;
  /** Called with the hls instance (null for native HLS) once the source is attached. */
  onReady?(hls: Hls | null): void;
}

// The device can't decode the stream's video (e.g. HEVC/HDR on Windows Chrome). Says nothing about the stream.
const CODEC_ERRORS = new Set([
  'manifestIncompatibleCodecsError',
  'bufferIncompatibleCodecsError',
  'bufferAddCodecError',
]);

/** Classify a fatal hls.js error into what we tell the viewer. */
export function classifyHlsError(data: Pick<ErrorData, 'type' | 'details' | 'response'>): PlaybackError {
  if (CODEC_ERRORS.has(data.details)) return 'unsupported_codec';
  const status = data.response?.code;
  if (status === 403 || status === 451) return 'geo_blocked';
  if (data.type === 'mediaError') return 'media';
  if (data.type === 'networkError') {
    // Status 0 means the browser refused the response: CORS, mixed content or a blocked host.
    if (status === 0 || status === undefined) {
      return data.details?.toLowerCase().includes('timeout') ? 'timeout' : 'browser_blocked';
    }
    return 'offline';
  }
  return 'unknown';
}

const canPlayNativeHls = (video: HTMLVideoElement) =>
  video.canPlayType('application/vnd.apple.mpegurl') !== '';

/** Start downloading hls.js early (the player calls this on load) so it's ready before the stream is. */
export const preloadHls = () => import('hls.js');

/**
 * Attach an HLS stream to a <video>. hls.js where Media Source is available, otherwise native HLS (Safari, iOS).
 * Always call destroy() before attaching the next channel.
 */
export async function attachStream(
  video: HTMLVideoElement,
  url: string,
  opts: AttachOptions,
): Promise<Attached> {
  const { default: HlsClass } = await import('hls.js');
  if (HlsClass.isSupported()) {
    let native: Attached | null = null;
    const hls = new HlsClass({
      manifestLoadingTimeOut: 10_000,
      fragLoadingTimeOut: 15_000,
      backBufferLength: 30,
      // Fast first frame: fetch the first segment while the media element attaches, and don't pick a
      // rendition bigger than the player is showing.
      startFragPrefetch: true,
      capLevelToPlayerSize: true,
    });
    let mediaRecoveries = 0;
    hls.on(HlsClass.Events.ERROR, (_e, data) => {
      if (!data.fatal || native) return;
      const error = classifyHlsError(data);
      // One media recovery attempt fixes most decoder hiccups (not a missing codec).
      if (error === 'media' && mediaRecoveries++ < 1) return hls.recoverMediaError();
      // The platform player needs no CORS and has its own decoders (HEVC/HDR on Apple devices and many
      // Android phones), so where it exists it may play what hls.js can't.
      if ((error === 'browser_blocked' || error === 'unsupported_codec') && canPlayNativeHls(video)) {
        hls.destroy();
        native = attachNative(video, url, () => opts.onError(error));
        void video.play().catch(() => {});
        return;
      }
      opts.onError(error);
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    opts.onReady?.(hls);
    return {
      destroy() {
        if (native) native.destroy();
        else hls.destroy();
      },
    };
  }

  if (canPlayNativeHls(video)) {
    const attached = attachNative(video, url, () =>
      opts.onError(url.startsWith('http:') ? 'browser_blocked' : 'offline'),
    );
    opts.onReady?.(null);
    return attached;
  }

  queueMicrotask(() => opts.onError('browser_blocked'));
  return { destroy() {} };
}

function attachNative(video: HTMLVideoElement, url: string, onError: () => void): Attached {
  video.addEventListener('error', onError);
  video.src = url;
  return {
    destroy() {
      video.removeEventListener('error', onError);
      video.removeAttribute('src');
      video.load();
    },
  };
}
