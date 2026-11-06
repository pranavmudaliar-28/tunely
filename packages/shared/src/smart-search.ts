/** A filter value and every name a viewer might type for it (e.g. "Tamil" and "தமிழ்"). */
export interface Named {
  id: string;
  names: string[];
}

export interface SearchDictionary {
  categories: Named[];
  languages: Named[];
  countries: Named[];
}

export interface ParsedQuery {
  category?: string;
  language?: string;
  country?: string;
  /** What's left to match against channel names. */
  rest: string;
}

/** Short names people type for countries that iptv-org spells out. */
const COUNTRY_ALIASES: Record<string, string> = { uk: 'GB', usa: 'US', uae: 'AE' };

// Combining accents used by Latin letters (U+0300–U+036F). Other scripts' combining marks are part of the letter.
const LATIN_ACCENTS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g');
// Lowercase, Latin accents off ("Français" = "francais").
const norm = (s: string) => s.normalize('NFKD').replace(LATIN_ACCENTS, '').toLowerCase().trim();
const matches = (name: string, phrase: string) => {
  const n = norm(name);
  return n === phrase || n === `${phrase}s` || `${n}s` === phrase;
};

/**
 * "tamil news" → { language: 'tam', category: 'news', rest: '' }; "zee tamil" → { language: 'tam', rest: 'zee' }.
 * Longer phrases are tried first ("united kingdom" before "kingdom"); each kind of filter is taken once. Callers fall
 * back to a plain name search when the filtered one finds nothing, since a word can be part of a channel's name.
 */
export function parseQuery(q: string, dict: SearchDictionary): ParsedQuery {
  const words = norm(q).split(/\s+/).filter(Boolean);
  const out: ParsedQuery = { rest: '' };
  const kinds = [
    ['language', dict.languages],
    ['category', dict.categories],
    ['country', dict.countries],
  ] as const;
  for (let len = 3; len >= 1; len--) {
    for (let i = 0; i + len <= words.length; i++) {
      const phrase = words.slice(i, i + len).join(' ');
      for (const [kind, list] of kinds) {
        if (out[kind]) continue;
        const id =
          (kind === 'country' && len === 1 ? COUNTRY_ALIASES[phrase] : undefined) ??
          list.find((e) => e.names.some((n) => matches(n, phrase)))?.id;
        if (!id) continue;
        out[kind] = id;
        words.splice(i, len);
        i--;
        break;
      }
    }
  }
  out.rest = words.join(' ');
  return out;
}

/** True when the query named at least one filter. */
export const hasFilters = (p: ParsedQuery) => Boolean(p.category || p.language || p.country);
