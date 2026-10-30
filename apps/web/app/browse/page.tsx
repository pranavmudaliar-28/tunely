import type { Metadata } from 'next';
import { BrowsePage } from '@/components/channel/browse-page';

const STATUSES = ['live', 'offline', 'no_stream', 'closed'] as const;

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : undefined;

// Filtered and search URLs canonicalize to /browse and stay out of search; the bare directory is indexable.
export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const filtered = Object.keys(await searchParams).length > 0;
  return {
    title: 'Browse live TV channels',
    alternates: { canonical: '/browse' },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function Browse({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const filters = {
    country: one(sp.country)?.toUpperCase().slice(0, 2),
    category: one(sp.category),
    language: one(sp.language),
    q: one(sp.q),
    status: STATUSES.find((s) => s === one(sp.status)),
  };
  return <BrowsePage title="Browse channels" filters={filters} />;
}
