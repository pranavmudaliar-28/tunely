import type { Channel, FacetCount, Facets } from '@tunely/shared';
import type { Metadata } from 'next';
import { countryName } from './format';
import { SITE_NAME, SITE_URL } from './site';

const list = (items: string[]) => new Intl.ListFormat('en', { type: 'conjunction' }).format(items);

type Names = Record<string, string>;

/** Country, category and language pages with fewer live channels than this stay out of search: they'd be thin. */
export const INDEX_MIN_LIVE = 10;

export const isIndexableFacet = (live: FacetCount[], id: string) =>
  (live.find((f) => f.id === id)?.count ?? 0) >= INDEX_MIN_LIVE;

/** robots for a facet page. If live counts can't load, stay indexable rather than hide every page for 5 minutes. */
export function facetRobots(live: number | undefined): Metadata['robots'] {
  return live === undefined || live >= INDEX_MIN_LIVE ? undefined : { index: false, follow: true };
}

/** Live channels under the filters a facets response was computed for (statuses ignore the status filter). */
export const liveTotal = (counts: Facets) => counts.statuses.find((s) => s.id === 'live')?.count ?? 0;

/** Display names of the biggest options in a facet list, e.g. the top 3 languages of a country. */
export function topNames(items: FacetCount[], names: (id: string) => string | undefined, n = 3): string[] {
  return [...items]
    .sort((a, b) => b.count - a.count)
    .map((f) => names(f.id))
    .filter((name): name is string => Boolean(name))
    .slice(0, n);
}

/** Meta description for a facet page, e.g. "661 Indian TV channels are live now, in Hindi, Tamil and Telugu…". */
export function liveDescription(live: number, what: string, details: string[]): string {
  const extra = details.filter(Boolean).join(', ');
  const lead =
    live > 0
      ? `${live.toLocaleString('en')} ${what} are live now${extra ? `, ${extra}` : ''}.`
      : `See all the ${what} we know of, with their live status.`;
  return `${lead} Watch free in your browser on phone, computer or TV. No app, no sign-up.`;
}

export const joinNames = list;

/** id → display name lookup for a facet list ("hin" → "Hindi"). */
export const nameLookup = (items: { id: string; name: string }[]) => {
  const names = new Map(items.map((f) => [f.id, f.name]));
  return (id: string) => names.get(id);
};

/** "General" says nothing in a description. */
export const describable = (items: FacetCount[]) => items.filter((f) => f.id !== 'general');

/** A readable paragraph about a channel, built only from catalog data (so every watch page has real text). */
export function channelAbout(c: Channel, languageNames: Names, categoryNames: Names): string {
  const languages = c.languages.map((l) => languageNames[l] ?? l);
  const categories = c.categories.map((k) => categoryNames[k] ?? k);
  const parts = [
    `${c.name} is a TV channel from ${countryName(c.country)}` +
      (languages.length ? `, broadcasting in ${list(languages)}.` : '.'),
  ];
  if (categories.length) parts.push(`It is listed under ${list(categories)}.`);
  parts.push(
    c.status === 'live'
      ? `Watch it live and free on ${SITE_NAME}, right in your browser on a phone, computer or TV, with no app or sign-up` +
          (c.quality ? ` (up to ${c.quality}).` : '.')
      : c.status === 'closed'
        ? 'The broadcaster has closed this channel.'
        : `Its stream isn't playing right now. ${SITE_NAME} checks every channel several times a day, so check back later.`,
  );
  return parts.join(' ');
}

/** Intro text for a browse page, e.g. "Tunely lists 1,582 TV channels from India, 661 of them live now." */
export function browseIntro(subject: string, count: number | undefined, live?: number): string {
  const liveNow = live ? `, ${live.toLocaleString('en')} of them live now` : '';
  const lead = count
    ? `${SITE_NAME} lists ${count.toLocaleString('en')} TV channels ${subject}${liveNow}.`
    : '';
  return `${lead} Live channels come first and play free in your browser, with no app or sign-up; the rest are labelled offline, no stream or closed.`.trim();
}

/** Serialise JSON-LD safely: channel names come from iptv-org, so a "</script>" in one must not break out. */
export function jsonLdString(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function channelJsonLd(c: Channel, languageNames: Names) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TelevisionChannel',
    name: c.name,
    url: `${SITE_URL}/watch/${encodeURIComponent(c.id)}`,
    providesBroadcastService: {
      '@type': 'BroadcastService',
      name: c.name,
      ...(c.logo && { logo: c.logo }),
      areaServed: { '@type': 'Country', name: countryName(c.country) },
      inLanguage: c.languages.map((l) => languageNames[l] ?? l),
      ...(c.website && { sameAs: c.website }),
    },
  };
}
