import { z } from 'zod';

// Just enough XMLTV for programme listings, without an XML dependency. The files come from a third party, so every
// value is untrusted: entities are decoded, markup is stripped, and each programme is validated before it is kept.

export interface Programme {
  channelId: string;
  start: Date;
  stop: Date;
  title: string;
  description: string | null;
}

/** "20261105232643 +0000" → Date. No offset means UTC. Null if malformed. */
export function xmltvTime(s: string | undefined): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?$/.exec(s?.trim() ?? '');
  if (!m) return null;
  const [, y, mo, d, h, mi, se, sign, oh, om] = m;
  const offset = sign ? (sign === '-' ? -1 : 1) * (Number(oh) * 60 + Number(om)) * 60_000 : 0;
  const t = Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, +se!) - offset;
  return Number.isFinite(t) ? new Date(t) : null;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Text content: CDATA unwrapped, tags dropped, entities decoded, whitespace collapsed. */
export function xmlText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, e: string) => {
      if (e[0] === '#') {
        const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
      }
      return ENTITIES[e.toLowerCase()] ?? whole;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

const attr = (attrs: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1];
const child = (body: string, tag: string) =>
  new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`).exec(body)?.[1];

const MAX_LENGTH_MS = 24 * 3600_000;
const ProgrammeSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(300).nullable(),
    start: z.date(),
    stop: z.date(),
  })
  .refine((p) => p.stop > p.start && p.stop.getTime() - p.start.getTime() <= MAX_LENGTH_MS);

/**
 * Programmes for the wanted channels that overlap [from, to). `wanted` maps the file's channel id (the part of
 * site_id after "#") to our channel ids; several of ours can share one listing.
 */
export function parseProgrammes(
  xml: string,
  wanted: Map<string, string[]>,
  from: Date,
  to: Date,
): Programme[] {
  const out: Programme[] = [];
  for (const m of xml.matchAll(/<programme\b([^>]*)>([\s\S]*?)<\/programme>/g)) {
    const [, attrs = '', body = ''] = m;
    const ids = wanted.get(xmlText(attr(attrs, 'channel') ?? ''));
    if (!ids) continue;
    const start = xmltvTime(attr(attrs, 'start'));
    const stop = xmltvTime(attr(attrs, 'stop'));
    if (!start || !stop || stop <= from || start >= to) continue;
    const titleRaw = child(body, 'title');
    const descRaw = child(body, 'desc');
    const parsed = ProgrammeSchema.safeParse({
      title: titleRaw ? xmlText(titleRaw).slice(0, 200) : '',
      description: descRaw ? xmlText(descRaw).slice(0, 300) || null : null,
      start,
      stop,
    });
    if (!parsed.success) continue;
    for (const channelId of ids) out.push({ channelId, ...parsed.data });
  }
  return out;
}

/** A listing in i.mjh.nz's site_id ("Plex/us#5e20…"): the file path and the channel id inside it. Null if odd. */
export function splitSiteId(siteId: string): { file: string; channel: string } | null {
  const m = /^([A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)#([^\s#"<>]{1,200})$/.exec(siteId);
  return m ? { file: m[1]!, channel: m[2]! } : null;
}

/**
 * The fewest files that list every wanted channel, greedily (most new channels first), up to `max`. Each file's
 * `wanted` holds every channel it lists, not only the new ones: a listing can be stale (no programmes), and another
 * chosen file may still have that channel's schedule.
 */
export function pickFiles(listings: { channelId: string; file: string; channel: string }[], max: number) {
  const byFile = new Map<string, { channelId: string; channel: string }[]>();
  for (const l of listings) {
    if (!byFile.has(l.file)) byFile.set(l.file, []);
    byFile.get(l.file)!.push(l);
  }
  const covered = new Set<string>();
  const picked: { file: string; wanted: Map<string, string[]> }[] = [];
  while (picked.length < max) {
    let best: string | null = null;
    let gain = 0;
    for (const [file, ls] of byFile) {
      const g = new Set(ls.filter((l) => !covered.has(l.channelId)).map((l) => l.channelId)).size;
      if (g > gain || (g === gain && g > 0 && best !== null && file < best)) [best, gain] = [file, g];
    }
    if (!best || gain === 0) break;
    const wanted = new Map<string, string[]>();
    for (const l of byFile.get(best)!) {
      wanted.set(l.channel, [...(wanted.get(l.channel) ?? []), l.channelId]);
      covered.add(l.channelId);
    }
    picked.push({ file: best, wanted });
    byFile.delete(best);
  }
  return picked;
}
