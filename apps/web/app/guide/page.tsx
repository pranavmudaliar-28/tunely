import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideList } from '@/components/channel/guide';
import { api } from '@/lib/api-client';
import { guideSections } from '@/lib/guide';

// What's on changes all the time; each channel also carries its next programmes, so the browser shows the right one.
export const revalidate = 300;
export const metadata: Metadata = {
  title: "What's on now: free live TV guide",
  description: 'What is on now and next on free live TV channels, by category. Times in your time zone.',
  alternates: { canonical: '/guide' },
};

const PER_SECTION = 6;

export default async function GuidePage() {
  const [items, categories] = await Promise.all([
    api.guide().catch(() => []),
    api.categories().catch(() => []),
  ]);
  const names = new Map(categories.map((c) => [c.id, c.name]));
  return (
    <div className="flex flex-col gap-10 px-4 pt-8 pb-16 sm:px-14">
      <header className="flex flex-col gap-2">
        <h1 className="text-[32px] font-bold tracking-[-0.02em]">What&apos;s on now</h1>
        <p className="text-text-muted max-w-[640px]">
          {items.length
            ? `Programme guide for ${items.length} live channels. Times are in your time zone; "Remind me" adds the programme to your calendar.`
            : 'The programme guide is being updated. Try again in a few minutes.'}
        </p>
      </header>
      {guideSections(items).map(([cat, list]) => (
        <section key={cat} aria-labelledby={`g-${cat}`} className="flex max-w-[960px] flex-col gap-2">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id={`g-${cat}`} className="text-xl font-semibold">
              {names.get(cat) ?? cat}
            </h2>
            {list.length > PER_SECTION && (
              <Link data-nav href={`/guide/${cat}`} className="text-text-muted shrink-0 text-[15px]">
                All {list.length}
              </Link>
            )}
          </div>
          <GuideList items={list.slice(0, PER_SECTION)} />
        </section>
      ))}
    </div>
  );
}
