// Just enough HLS parsing to find a variant, a segment and the resolution.

export interface Variant {
  uri: string;
  bandwidth: number;
  height: number | null;
}

export type Playlist = { kind: 'master'; variants: Variant[] } | { kind: 'media'; segments: string[] };

export function parsePlaylist(text: string): Playlist | null {
  const lines = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) // strip BOM
    .split(/\r?\n/)
    .map((l) => l.trim());
  if (lines[0] !== '#EXTM3U') return null;

  const variants: Variant[] = [];
  const segments: string[] = [];
  let pendingVariant: Omit<Variant, 'uri'> | null = null;
  for (const line of lines.slice(1)) {
    if (!line) continue;
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const attrs = line.slice('#EXT-X-STREAM-INF:'.length);
      const res = /RESOLUTION=(\d+)x(\d+)/i.exec(attrs);
      pendingVariant = {
        bandwidth: Number(/(?:^|,)BANDWIDTH=(\d+)/i.exec(attrs)?.[1] ?? 0),
        height: res ? Number(res[2]) : null,
      };
    } else if (!line.startsWith('#')) {
      if (pendingVariant) {
        variants.push({ uri: line, ...pendingVariant });
        pendingVariant = null;
      } else {
        segments.push(line);
      }
    }
  }
  return variants.length ? { kind: 'master', variants } : { kind: 'media', segments };
}

/** The lowest-bandwidth variant, so the check stays cheap. */
export function pickVariant(variants: Variant[]): Variant {
  return [...variants].sort((a, b) => a.bandwidth - b.bandwidth)[0]!;
}

export function maxHeight(variants: Variant[]): number | null {
  const hs = variants.map((v) => v.height).filter((h): h is number => h !== null);
  return hs.length ? Math.max(...hs) : null;
}
