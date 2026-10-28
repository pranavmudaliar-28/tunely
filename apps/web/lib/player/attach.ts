import type Hls from 'hls.js';
import type { ErrorData } from 'hls.js';

export type PlaybackError = 'offline' | 'geo_blocked' | 'browser_blocked' | 'timeout' | 'media' | 'unknown';

export interface Attached {
  destroy(): void;
}

export interface AttachOptions {
  onError(type: PlaybackError): void;
  /** Called with the hls instance (null for native HLS) once the source is attached. */
  onReady?(hls: Hls | null): void;
}

/** Classify a fatal hls.js error into what we tell the viewer. */
export function classifyHlsError(data: Pick<ErrorData, 'type' | 'details' | 'response'>): PlaybackError {
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
    const hls = new HlsClass({
      manifestLoadingTimeOut: 10_000,
      fragLoadingTimeOut: 15_000,
      backBufferLength: 30,
    });
    let mediaRecoveries = 0;
    hls.on(HlsClass.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      // One media recovery attempt fixes most decoder hiccups.
      if (data.type === HlsClass.ErrorTypes.MEDIA_ERROR && mediaRecoveries++ < 1)
        return hls.recoverMediaError();
      opts.onError(classifyHlsError(data));
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    opts.onReady?.(hls);
    return {
      destroy() {
        hls.destroy();
      },
    };
  }

  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    const onError = () => opts.onError(url.startsWith('http:') ? 'browser_blocked' : 'offline');
    video.addEventListener('error', onError);
    video.src = url;
    opts.onReady?.(null);
    return {
      destroy() {
        video.removeEventListener('error', onError);
        video.removeAttribute('src');
        video.load();
      },
    };
  }

  queueMicrotask(() => opts.onError('browser_blocked'));
  return { destroy() {} };
}
