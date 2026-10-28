import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrowsePage } from '@/components/channel/browse-page';
import { api } from '@/lib/api-client';

export const revalidate = 1800;
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
    title: `${name} channels live`,
    description: `Watch free ${name.toLowerCase()} channels live in your browser.`,
    alternates: { canonical: `/category/${slug}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug, name } = await category(params);
  return <BrowsePage title={`${name} channels`} filters={{ category: slug }} />;
}
