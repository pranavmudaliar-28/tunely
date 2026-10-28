import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { isIP, type LookupFunction } from 'node:net';
import ipaddr from 'ipaddr.js';
import { Agent, request, type Dispatcher } from 'undici';

// Fetcher for untrusted stream URLs. Every hop is checked: scheme, literal IPs, and every
// address DNS returns, so a public name that resolves to 10.x or 127.x is refused at connect time.

export const MAX_REDIRECTS = 3;
export const TIMEOUT_MS = 10_000;

export class SafeFetchError extends Error {
  constructor(
    public code:
      'bad_url' | 'blocked_ip' | 'dns' | 'timeout' | 'too_many_redirects' | 'too_large' | 'network',
    message?: string,
  ) {
    super(message ?? code);
  }
}

/** True for addresses we must never connect to: anything ipaddr.js doesn't classify as plain unicast. */
export function isBlockedAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return true;
  let ip = ipaddr.parse(address);
  if (ip.kind() === 'ipv6' && (ip as ipaddr.IPv6).isIPv4MappedAddress())
    ip = (ip as ipaddr.IPv6).toIPv4Address();
  // NAT64 (64:ff9b::/96, from DNS64 resolvers) embeds the real IPv4 address in the last 32 bits: judge that.
  if (ip.kind() === 'ipv6' && ip.range() === 'rfc6052') {
    const bytes = (ip as ipaddr.IPv6).toByteArray().slice(12);
    ip = ipaddr.fromByteArray(bytes);
  }
  return ip.range() !== 'unicast';
}

export const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses: LookupAddress[]) => {
    if (err) return callback(err, '', 0);
    const bad = addresses.find((a) => isBlockedAddress(a.address));
    if (bad || addresses.length === 0) {
      return callback(
        new SafeFetchError('blocked_ip', `${hostname} resolves to ${bad?.address ?? 'nothing'}`),
        '',
        0,
      );
    }
    if (options.all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, addresses);
    callback(null, addresses[0]!.address, addresses[0]!.family);
  });
};

export const safeAgent = new Agent({
  connect: { lookup: safeLookup, timeout: TIMEOUT_MS },
  headersTimeout: TIMEOUT_MS,
  bodyTimeout: TIMEOUT_MS,
});

function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError('bad_url');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new SafeFetchError('bad_url', url.protocol);
  if (url.username || url.password) throw new SafeFetchError('bad_url', 'credentials in url');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  // Literal IPs never hit the DNS lookup hook, so check them here.
  if (isIP(host) && isBlockedAddress(host)) throw new SafeFetchError('blocked_ip', host);
  return url;
}

export interface SafeResponse {
  url: string; // final URL after redirects
  status: number;
  headers: Record<string, string>;
  body: Buffer;
  truncated: boolean;
}

export interface SafeFetchOptions {
  headers?: Record<string, string>;
  maxBytes: number;
  /** Stop reading after this many bytes without failing (used for segments). */
  readBytes?: number;
  signal?: AbortSignal;
  dispatcher?: Dispatcher;
}

export async function safeFetch(rawUrl: string, opts: SafeFetchOptions): Promise<SafeResponse> {
  const signal = opts.signal ?? AbortSignal.timeout(TIMEOUT_MS);
  let url = checkUrl(rawUrl);
  for (let hop = 0; ; hop++) {
    let res: Dispatcher.ResponseData;
    try {
      res = await request(url, {
        method: 'GET',
        headers: opts.headers,
        signal,
        dispatcher: opts.dispatcher ?? safeAgent,
      });
    } catch (err) {
      throw toSafeError(err, signal);
    }
    // The shared abort signal can fire after we stop reading; without a listener that crashes the process.
    res.body.on('error', () => {});

    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      res.body.destroy();
      if (hop >= MAX_REDIRECTS) throw new SafeFetchError('too_many_redirects');
      url = checkUrl(new URL(String(res.headers.location), url).toString());
      continue;
    }

    const declared = Number(res.headers['content-length']);
    if (declared > opts.maxBytes && !opts.readBytes) {
      res.body.destroy();
      throw new SafeFetchError('too_large', `${declared} bytes`);
    }

    const limit = Math.min(opts.readBytes ?? opts.maxBytes, opts.maxBytes);
    const chunks: Buffer[] = [];
    let size = 0;
    let truncated = false;
    try {
      for await (const chunk of res.body) {
        size += chunk.length;
        chunks.push(chunk as Buffer);
        if (size >= limit) {
          if (!opts.readBytes) throw new SafeFetchError('too_large');
          truncated = true;
          break;
        }
      }
    } catch (err) {
      throw toSafeError(err, signal);
    } finally {
      res.body.destroy();
    }

    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(res.headers))
      if (v !== undefined) headers[k] = Array.isArray(v) ? v.join(', ') : v;
    return { url: url.toString(), status: res.statusCode, headers, body: Buffer.concat(chunks), truncated };
  }
}

function toSafeError(err: unknown, signal: AbortSignal): SafeFetchError {
  if (err instanceof SafeFetchError) return err;
  const cause = (err as { cause?: unknown }).cause;
  if (cause instanceof SafeFetchError) return cause;
  if (
    signal.aborted ||
    (err as Error).name === 'TimeoutError' ||
    /timeout/i.test((err as Error).name ?? '')
  ) {
    return new SafeFetchError('timeout');
  }
  const code = (err as { code?: string }).code ?? '';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return new SafeFetchError('dns', code);
  return new SafeFetchError('network', (err as Error).message);
}
