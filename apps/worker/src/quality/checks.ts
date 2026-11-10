// Catalog quality checks for curators (A3): likely duplicates, categories the name contradicts, missing data.
// Rules only, no AI. They flag; a person decides (pnpm --filter @tunely/worker curate ..., or a fix upstream).

export type QualityChannel = {
  id: string;
  name: string;
  country: string;
  categories: string[];
  languages: string[];
  logo: string | null;
  score: number | null;
};

/** Words that don't tell channels apart ("Aaj Tak HD" is "Aaj Tak"). */
const NOISE = /\b(hd|sd|uhd|4k|fhd|tv|channel|television|live|official)\b/g;

/** Name reduced for comparison: lower case, accents and punctuation dropped, noise words removed. "+" stays a word:
 * "ETV" and "ETV+" are different channels. */
export function nameKey(name: string): string {
  return name
    .replaceAll('+', ' plus ')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Channels in the same country whose names only differ by noise. Best score first in each group. */
export function duplicateGroups(channels: QualityChannel[]): QualityChannel[][] {
  const groups = new Map<string, QualityChannel[]>();
  for (const c of channels) {
    const key = nameKey(c.name);
    if (key.length < 2) continue; // "TV" alone says nothing
    const k = `${c.country}:${key}`;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => g.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.id.localeCompare(b.id)));
}

const IMPLIED: [category: string, pattern: RegExp][] = [
  ['news', /\bnews\b/i],
  ['sports', /\bsports?\b/i],
  ['kids', /\b(kids|junior|cartoons?|toons)\b/i],
  ['movies', /\b(movies?|cinema|films?)\b/i],
  ['music', /\bmusic\b/i],
];

/** Categories the name suggests that the channel doesn't have ("XYZ News" not in news). */
export function missingImpliedCategories(c: Pick<QualityChannel, 'name' | 'categories'>): string[] {
  return IMPLIED.filter(([cat, re]) => re.test(c.name) && !c.categories.includes(cat)).map(([cat]) => cat);
}

export function missingData(c: QualityChannel): string[] {
  return [!c.logo && 'logo', !c.categories.length && 'category', !c.languages.length && 'language'].filter(
    (x): x is string => Boolean(x),
  );
}
