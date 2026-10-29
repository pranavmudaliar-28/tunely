import type { Channel } from '@tunely/shared';
import { countryName } from './format';
import { SITE_NAME, SITE_URL } from './site';

const list = (items: string[]) => new Intl.ListFormat('en', { type: 'conjunction' }).format(items);

type Names = Record<string, string>;

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

/** Intro text for a browse page, e.g. "Tunely lists 412 TV channels from India." */
export function browseIntro(subject: string, count: number | undefined): string {
  const lead = count ? `${SITE_NAME} lists ${count.toLocaleString('en')} TV channels ${subject}.` : '';
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
