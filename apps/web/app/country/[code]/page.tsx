import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrowsePage } from '@/components/channel/browse-page';
import { api } from '@/lib/api-client';
import { countryName } from '@/lib/format';
import {
  describable,
  facetRobots,
  joinNames,
  liveDescription,
  liveTotal,
  nameLookup,
  topNames,
} from '@/lib/seo';

// Channel statuses change as streams are checked: refresh every 5 minutes.
export const revalidate = 300;
export const generateStaticParams = async () => [];

type Props = { params: Promise<{ code: string }> };
const parse = async (params: Props['params']) => {
  const code = (await params).code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) notFound();
  return code;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = await parse(params);
  const name = countryName(code);
  // Same request as the page's own counts, so Next's fetch cache serves both.
  const [counts, languages, categories] = await Promise.all([
    api.facets({ country: code }).catch(() => null),
    api.languages().catch(() => []),
    api.categories().catch(() => []),
  ]);
  const langs = counts ? topNames(counts.languages, nameLookup(languages)) : [];
  const cats = counts ? topNames(describable(counts.categories), nameLookup(categories)) : [];
  return {
    robots: facetRobots(counts ? liveTotal(counts) : undefined),
    title: `${name} Live TV Channels List: Watch Free Online`,
    description: counts
      ? liveDescription(liveTotal(counts), `TV channels from ${name}`, [
          langs.length ? `in ${joinNames(langs)}` : '',
          cats.length ? `including ${joinNames(cats.map((c) => c.toLowerCase()))} channels` : '',
        ])
      : `Watch free live TV channels from ${name} in your browser on phone, computer or TV. No app, no sign-up.`,
    alternates: { canonical: `/country/${code.toLowerCase()}` },
  };
}

export default async function CountryPage({ params }: Props) {
  const code = await parse(params);
  const name = countryName(code);
  return <BrowsePage title={`Live TV from ${name}`} subject={`from ${name}`} filters={{ country: code }} />;
}
