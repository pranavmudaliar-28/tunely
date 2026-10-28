import type { ChannelSummary } from '@tunely/shared';

// iptv-org uses ISO 639-3 codes; Intl wants BCP 47. Only the languages we feature need native names.
const ISO3_TO_1: Record<string, string> = {
  hin: 'hi',
  guj: 'gu',
  tam: 'ta',
  tel: 'te',
  ben: 'bn',
  mar: 'mr',
  pan: 'pa',
  urd: 'ur',
  mal: 'ml',
  kan: 'kn',
  ori: 'or',
  asm: 'as',
  eng: 'en',
  fra: 'fr',
  deu: 'de',
  spa: 'es',
  por: 'pt',
  ara: 'ar',
  rus: 'ru',
  zho: 'zh',
  jpn: 'ja',
  kor: 'ko',
  ita: 'it',
  tur: 'tr',
  nld: 'nl',
  pol: 'pl',
  ind: 'id',
};

/** "हिन्दी" for hin, falling back to the English name. */
export function nativeLanguageName(code: string, fallback: string): string {
  const tag = ISO3_TO_1[code];
  if (!tag) return fallback;
  try {
    return new Intl.DisplayNames([tag], { type: 'language' }).of(tag) ?? fallback;
  } catch {
    return fallback;
  }
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
export function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Up to three letters for the logo fallback tile: "DD News" -> "DN", "France 24" -> "F24". */
export function monogram(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 1) return words[0]!.slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => (/^\d+$/.test(w) ? w : w[0]))
    .join('')
    .toUpperCase()
    .slice(0, 4);
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "India · Hindi · News" style subtitle. */
export function channelMeta(
  c: Pick<ChannelSummary, 'country' | 'categories' | 'languages'>,
  languageNames?: Record<string, string>,
) {
  const lang = c.languages[0];
  return [
    countryName(c.country),
    lang ? (languageNames?.[lang] ?? lang) : null,
    c.categories[0] ? titleCase(c.categories[0]) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Stable tint for logo tiles, from the canvas palette. */
const TINTS = ['#3B82F64D', '#A855F74D', '#22C55E4D', '#F59E0B4D', '#06B6D44D', '#EC48994D'];
export function tint(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length]!;
}

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 3600) return 'Watched just now';
  if (s < 86_400) return `Watched ${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86_400);
  return d === 1 ? 'Watched yesterday' : `Watched ${d} days ago`;
}
