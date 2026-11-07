import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GuideList } from '@/components/channel/guide';
import { api } from '@/lib/api-client';

export const revalidate = 300;
export const generateStaticParams = async () => [];

type Props = { params: Promise<{ category: string }> };

async function load(params: Props['params']) {
  const slug = (await params).category;
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) notFound();
  const [items, categories] = await Promise.all([
    api.guide().catch(() => []),
    api.categories().catch(() => []),
  ]);
  const name = categories.find((c) => c.id === slug)?.name;
  if (!name) notFound();
  return { slug, name, items: items.filter((c) => c.categories.includes(slug)) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, name, items } = await load(params);
  return {
    title: `${name} on TV now: live guide`,
    description: `What is on now and next on ${items.length} free live ${name.toLowerCase()} channels.`,
    alternates: { canonical: `/guide/${slug}` },
    // An empty list today says nothing worth indexing.
    robots: items.length ? undefined : { index: false },
  };
}

export default async function GuideCategoryPage({ params }: Props) {
  const { name, items } = await load(params);
  return (
    <div className="flex flex-col gap-6 px-4 pt-8 pb-16 sm:px-14">
      <header className="flex flex-col gap-2">
        <Link href="/guide" className="text-text-muted text-[15px]">
          ← What&apos;s on now
        </Link>
        <h1 className="text-[32px] font-bold tracking-[-0.02em]">{name} on now</h1>
      </header>
      {items.length ? (
        <div className="max-w-[960px]">
          <GuideList items={items} />
        </div>
      ) : (
        <p className="text-text-muted">No {name.toLowerCase()} channel has a programme guide right now.</p>
      )}
    </div>
  );
}
