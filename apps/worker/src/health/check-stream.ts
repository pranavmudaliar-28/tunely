import { safeFetch, SafeFetchError, type SafeFetchOptions } from '../net/safe-fetch';
import { maxHeight, parsePlaylist, pickVariant } from './m3u8';

export const MANIFEST_MAX_BYTES = 2 * 1024 * 1024;
export const SEGMENT_MAX_BYTES = 5 * 1024 * 1024;
// Reading the first 32 KB proves the segment is served without pulling whole video files.
const SEGMENT_READ_BYTES = 32 * 1024;
// Any origin works: we only check whether the server answers cross-origin reads.
export const CHECK_ORIGIN = 'https://tunely.app';

export interface StreamInput {
  url: string;
  referrer: string | null;
  userAgent: string | null;
}

export interface CheckResult {
  ok: boolean;
  httpStatus: number | null;
  isHttps: boolean;
  hasCors: boolean;
  needsHeaders: boolean;
  latencyMs: number | null;
  height: number | null;
  errorCode: string | null;
}

class CheckError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

const corsOk = (h: Record<string, string>) => {
  const v = h['access-control-allow-origin'];
  return v === '*' || v === CHECK_ORIGIN;
};

export async function checkStream(
  stream: StreamInput,
  fetchOpts: Pick<SafeFetchOptions, 'dispatcher'> = {},
): Promise<CheckResult> {
  const needsHeaders = Boolean(stream.referrer || stream.userAgent);
  const headers: Record<string, string> = { origin: CHECK_ORIGIN };
  if (stream.referrer) headers.referer = stream.referrer;
  if (stream.userAgent) headers['user-agent'] = stream.userAgent;

  const result: CheckResult = {
    ok: false,
    httpStatus: null,
    isHttps: false,
    hasCors: false,
    needsHeaders,
    latencyMs: null,
    height: null,
    errorCode: null,
  };
  const started = performance.now();
  // Each request has its own 10 s cap; this bounds the whole manifest → variant → segment chain.
  const signal = AbortSignal.timeout(20_000);
  let allHttps = true;
  let allCors = true;
  const get = async (url: string, segment = false) => {
    const res = await safeFetch(url, {
      ...fetchOpts,
      headers,
      signal,
      maxBytes: segment ? SEGMENT_MAX_BYTES : MANIFEST_MAX_BYTES,
      readBytes: segment ? SEGMENT_READ_BYTES : undefined,
    });
    result.httpStatus = res.status;
    allHttps &&= res.url.startsWith('https:');
    allCors &&= corsOk(res.headers);
    if (res.status >= 400) throw new CheckError(`http_${res.status}`);
    return res;
  };

  try {
    let manifest = await get(stream.url);
    result.latencyMs = Math.round(performance.now() - started);
    let playlist = parsePlaylist(manifest.body.toString('utf8'));
    if (!playlist) throw new CheckError('not_m3u8');

    if (playlist.kind === 'master') {
      result.height = maxHeight(playlist.variants);
      manifest = await get(new URL(pickVariant(playlist.variants).uri, manifest.url).toString());
      playlist = parsePlaylist(manifest.body.toString('utf8'));
      if (!playlist || playlist.kind !== 'media') throw new CheckError('not_m3u8');
    }
    const segment = playlist.segments.at(-1);
    if (!segment) throw new CheckError('no_segments');
    await get(new URL(segment, manifest.url).toString(), true);
    result.ok = true;
  } catch (err) {
    result.errorCode = err instanceof CheckError || err instanceof SafeFetchError ? err.code : 'unknown';
  }
  result.isHttps = allHttps;
  result.hasCors = allCors;
  return result;
}

/** Browsers can play it: https everywhere, CORS everywhere, no spoofed headers. */
export const isWebPlayable = (c: Pick<CheckResult, 'ok' | 'isHttps' | 'hasCors' | 'needsHeaders'>) =>
  c.ok && c.isHttps && c.hasCors && !c.needsHeaders;
