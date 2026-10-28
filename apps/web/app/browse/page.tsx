import type { Metadata } from 'next';
import { BrowsePage } from '@/components/channel/browse-page';

export const metadata: Metadata = { title: 'Browse live TV channels', alternates: { canonical: '/browse' } };

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : undefined;

export default async function Browse({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const filters = {
    country: one(sp.country)?.toUpperCase().slice(0, 2),
    category: one(sp.category),
    language: one(sp.language),
    q: one(sp.q),
  };
  return <BrowsePage title="Browse channels" filters={filters} />;
}
