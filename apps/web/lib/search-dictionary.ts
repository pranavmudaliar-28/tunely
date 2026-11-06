import type { SearchDictionary } from '@tunely/shared';
import { nativeLanguageName } from './format';

type Facet = { id: string; name: string };

/** Languages with the most channels; the long tail of ISO names ("Gen", "Sora") would catch channel names. */
const TOP_LANGUAGES = 80;

/** What smart search recognises: category and country names, and the top languages in English and their own script. */
export function searchDictionary(f: {
  categories: Facet[];
  languages: Facet[];
  countries: Facet[];
}): SearchDictionary {
  return {
    categories: f.categories.map((c) => ({ id: c.id, names: [c.name] })),
    // Facet lists come sorted by channel count.
    languages: f.languages
      .slice(0, TOP_LANGUAGES)
      .map((l) => ({ id: l.id, names: [l.name, nativeLanguageName(l.id, l.name)] })),
    countries: f.countries.map((c) => ({ id: c.id, names: [c.name] })),
  };
}
