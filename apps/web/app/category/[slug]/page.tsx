import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrowsePage } from '@/components/channel/browse-page';
import { api } from '@/lib/api-client';

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
  return {
    title: `${name} TV channels live: watch free online`,
    description: `Watch free ${name.toLowerCase()} TV channels live from around the world, in your browser. No app, no sign-up.`,
    alternates: { canonical: `/category/${slug}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug, name } = await category(params);
  return <BrowsePage title={`${name} channels`} subject={`in ${name}`} filters={{ category: slug }} />;
}
