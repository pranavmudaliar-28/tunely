import type { Metadata } from 'next';
import { BrowsePage } from '@/components/channel/browse-page';

export const metadata: Metadata = { title: 'Search channels', robots: { index: false } };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const raw = (await searchParams).q;
  const q = typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 80) : undefined;
  return (
    <BrowsePage
      title={q ? `Results for “${q}”` : 'Search channels'}
      intro="Tip: press Ctrl+K (or ⌘K) anywhere to search."
      filters={{ q }}
    />
  );
}
