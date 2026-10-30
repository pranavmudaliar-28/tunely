import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrowsePage } from '@/components/channel/browse-page';
import { api } from '@/lib/api-client';
import { countryName } from '@/lib/format';
import { facetRobots, joinNames, liveDescription, liveTotal, nameLookup, topNames } from '@/lib/seo';

// Channel statuses change as streams are checked: refresh every 5 minutes.
export const revalidate = 300;
export const generateStaticParams = async () => [];

type Props = { params: Promise<{ slug: string }> };

async function category(params: Props['params']) {
  const slug = (await params).slug;
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) notFound();
  const facet = (await api.categories().catch(() => [])).find((c) => c.id === slug);
  return { slug, name: facet?.name ?? slug };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, name } = await category(params);
  // Same request as the page's own counts, so Next's fetch cache serves both.
  const [counts, languages] = await Promise.all([
    api.facets({ category: slug }).catch(() => null),
    api.languages().catch(() => []),
  ]);
  const countries = counts ? topNames(counts.countries, countryName) : [];
  const langs = counts ? topNames(counts.languages, nameLookup(languages)) : [];
  return {
    robots: facetRobots(counts ? liveTotal(counts) : undefined),
    title: `Live ${name} TV Channels: Watch Free Online`,
    description: counts
      ? liveDescription(liveTotal(counts), `${name.toLowerCase()} TV channels`, [
          countries.length ? `from ${joinNames(countries)}` : '',
          langs.length ? `in ${joinNames(langs)}` : '',
        ])
      : `Watch free ${name.toLowerCase()} TV channels live from around the world, in your browser. No app, no sign-up.`,
    alternates: { canonical: `/category/${slug}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug, name } = await category(params);
  return <BrowsePage title={`${name} channels`} subject={`in ${name}`} filters={{ category: slug }} />;
}
