import Link from 'next/link';
import { api, type ChannelFilters } from '@/lib/api-client';
import { BrowseView } from './browse-view';

/** Server half of every browse-style page: heading, first page and facets rendered on the server. */
export async function BrowsePage({
  title,
  intro,
  filters,
}: {
  title: string;
  intro?: string;
  filters: ChannelFilters;
}) {
  const empty = { items: [], nextCursor: null };
  const [firstPage, countries, categories, languages] = await Promise.all([
    api.channels({ ...filters, limit: 48 }).catch(() => empty),
    api.countries().catch(() => []),
    api.categories().catch(() => []),
    api.languages().catch(() => []),
  ]);
  return (
    <div className="flex flex-col gap-6 px-4 pt-8 pb-16 sm:px-14">
      <div className="flex flex-col gap-1.5">
        <nav aria-label="Breadcrumb" className="text-text-muted text-[13px]">
          <Link href="/" className="text-text-muted">
            Home
          </Link>{' '}
          / {title}
        </nav>
        <h1 className="text-[32px] font-bold tracking-[-0.02em]">{title}</h1>
        <p className="text-text-muted text-[15px]">
          {intro ?? 'Only channels that are playing right now are shown.'}
        </p>
      </div>
      <BrowseView filters={filters} firstPage={firstPage} facets={{ countries, categories, languages }} />
    </div>
  );
}
