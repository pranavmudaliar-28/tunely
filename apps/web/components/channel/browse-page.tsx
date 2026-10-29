import Link from 'next/link';
import { AdBanner } from '@/components/ads/ad-banner';
import { api, type ChannelFilters } from '@/lib/api-client';
import { browseIntro } from '@/lib/seo';
import { BrowseView } from './browse-view';

/** Server half of every browse-style page: heading, first page and facets rendered on the server. */
export async function BrowsePage({
  title,
  intro,
  subject,
  filters,
}: {
  title: string;
  intro?: string;
  /** For a generated intro, e.g. "from India": "Tunely lists 412 TV channels from India…". */
  subject?: string;
  filters: ChannelFilters;
}) {
  const empty = { items: [], nextCursor: null };
  const [firstPage, countries, categories, languages] = await Promise.all([
    api.channels({ ...filters, limit: 48 }).catch(() => empty),
    api.countries().catch(() => []),
    api.categories().catch(() => []),
    api.languages().catch(() => []),
  ]);
  const facet = filters.country
    ? countries.find((f) => f.id === filters.country)
    : filters.category
      ? categories.find((f) => f.id === filters.category)
      : filters.language
        ? languages.find((f) => f.id === filters.language)
        : undefined;
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
          {intro ??
            (subject
              ? browseIntro(subject, facet?.count)
              : 'Every channel we know of. Live ones come first; the rest are labelled offline, no stream or closed.')}
        </p>
      </div>
      <BrowseView filters={filters} firstPage={firstPage} facets={{ countries, categories, languages }} />
      {firstPage.items.length > 0 && <AdBanner placement="browse" />}
    </div>
  );
}
