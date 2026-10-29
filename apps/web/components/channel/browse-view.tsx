'use client';

import type { ChannelList, ChannelStatus, Facet, FacetCount, Facets } from '@tunely/shared';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';
import { CloseIcon } from '@/components/ui/icons';
import { api, type ChannelFilters } from '@/lib/api-client';
import { channelMeta } from '@/lib/format';
import { ChannelCard, ChannelCardSkeleton } from './channel-card';
import { FacetCombobox, type ComboOption } from './facet-combobox';

const PAGE = 48;
const MIN_CARD = 200;
const GAP = 16;

export interface BrowseFacets {
  countries: Facet[];
  categories: Facet[];
  languages: Facet[];
}

type FilterKey = 'country' | 'category' | 'language';
const LABELS: Record<FilterKey, string> = { country: 'Country', category: 'Category', language: 'Language' };
const STATUS_LABEL: Record<ChannelStatus, string> = {
  live: 'Live now',
  offline: 'Offline',
  no_stream: 'No stream',
  closed: 'Closed',
};

const URL_KEYS = ['q', 'country', 'category', 'language', 'status'] as const;

/** Canonical /browse URL: fixed parameter order, so the same filters always give the same string. */
export function browseHref(f: Omit<ChannelFilters, 'cursor' | 'limit'>) {
  const params = new URLSearchParams();
  for (const k of URL_KEYS) if (f[k]) params.set(k, f[k]);
  const qs = params.toString();
  return `/browse${qs ? `?${qs}` : ''}`;
}

export function BrowseView({
  filters,
  firstPage,
  facets,
  initialCounts,
}: {
  filters: ChannelFilters;
  firstPage: ChannelList;
  /** Names (and catalog-wide counts, used if live counts can't load). */
  facets: BrowseFacets;
  /** Counts under the page's initial filters, fetched on the server. */
  initialCounts: Facets | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // History: the first search typed after any other change (a filter, Clear all) adds an entry; further
  // typing updates that entry. Each Back then undoes exactly one action, however fast the page loads.
  const lastWasTyping = useRef(false);

  // The search box is controlled, and the URL is the source of truth for what's applied. While our own
  // navigations are in flight the props lag behind, so we remember the URLs we navigated to and only
  // resync the box (and the filters we build on) when the URL changes for another reason: back button,
  // a link, a chip.
  const [term, setTerm] = useState(filters.q ?? '');
  // Phones: the four selects fold behind a Filters button so results start above the fold.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [ownHrefs, setOwnHrefs] = useState<string[]>([]);
  const href = browseHref(filters);
  const [appliedHref, setAppliedHref] = useState(href);
  if (href !== appliedHref) {
    setAppliedHref(href);
    if (!ownHrefs.includes(href)) setTerm(filters.q ?? '');
  }
  const typed = term.trim() || undefined;

  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The filters the viewer last asked for; the next URL is built from these, never from lagging props.
  const intended = useRef<ChannelFilters>(filters);
  useEffect(() => {
    if (!ownHrefs.includes(href)) intended.current = filters;
  }, [href, filters, ownHrefs]);

  const navigate = (next: ChannelFilters, replace: boolean) => {
    // A pending search-as-you-type would undo this navigation.
    clearTimeout(typingTimer.current);
    intended.current = next;
    const target = browseHref(next);
    const typedBefore = lastWasTyping.current;
    lastWasTyping.current = replace;
    setOwnHrefs((list) => [...list.slice(-9), target]);
    startTransition(() => {
      if (replace && typedBefore) router.replace(target, { scroll: false });
      else router.push(target, { scroll: false });
    });
  };
  // Every change carries the text currently in the box, applied or not.
  // Values come from our own selects and chips, so the status is always a valid ChannelStatus.
  const set = (patch: Partial<Record<FilterKey | 'q' | 'status', string | undefined>>, replace = false) =>
    navigate({ ...intended.current, q: typed, ...patch } as ChannelFilters, replace);
  const clearAll = () => {
    setTerm('');
    navigate({}, false);
  };

  // Back/forward always means 'show me that URL', even one we navigated to ourselves earlier.
  useEffect(() => {
    const onPop = () => {
      clearTimeout(typingTimer.current);
      lastWasTyping.current = false;
      setOwnHrefs([]);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Search as you type, once typing pauses.
  useEffect(() => {
    if (typed === intended.current.q) return;
    typingTimer.current = setTimeout(() => set({}, true), 400);
    return () => clearTimeout(typingTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed]);

  const query = useInfiniteQuery({
    queryKey: ['browse', filters],
    queryFn: ({ pageParam }) =>
      api.channels({ ...filters, cursor: pageParam, limit: PAGE }, { cache: 'no-store' } as never),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialData: { pages: [firstPage], pageParams: [undefined] },
  });
  const items = useMemo(() => query.data.pages.flatMap((p) => p.items), [query.data]);

  // Dropdown counts follow every other filter and the search (each dimension ignores its own filter).
  const [serverHref] = useState(href);
  const counts = useQuery({
    queryKey: ['facets', href],
    queryFn: () => api.facets(filters, { cache: 'no-store' }),
    initialData: href === serverHref && initialCounts ? initialCounts : undefined,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  }).data;
  const optionsFor = (list: Facet[], live: FacetCount[] | undefined): ComboOption[] => {
    if (!live) return list;
    const names = new Map(list.map((f) => [f.id, f.name]));
    return live.map((f) => ({ id: f.id, name: names.get(f.id) ?? f.id, count: f.count }));
  };
  const statusCount = (s?: ChannelStatus) => {
    if (!counts) return '';
    const n = s
      ? (counts.statuses.find((x) => x.id === s)?.count ?? 0)
      : counts.statuses.reduce((sum, x) => sum + x.count, 0);
    return ` (${n.toLocaleString('en')})`;
  };

  const facetName = (key: FilterKey, id: string) => {
    const list =
      key === 'country' ? facets.countries : key === 'category' ? facets.categories : facets.languages;
    return list.find((f) => f.id === id)?.name ?? id;
  };
  const active = (Object.keys(LABELS) as FilterKey[]).filter((k) => filters[k]);
  const filterCount = active.length + (filters.status ? 1 : 0);

  return (
    <div className="flex flex-col gap-6">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          set({});
        }}
        className="border-border bg-surface flex flex-col gap-3 rounded-[12px] border p-3 sm:p-4"
      >
        <div className="flex items-end gap-2">
          <div className="flex min-w-0 grow flex-col gap-1.5">
            <label htmlFor="b-q" className="text-text-muted sr-only text-xs font-medium sm:not-sr-only">
              Search
            </label>
            <input
              id="b-q"
              name="q"
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              autoComplete="off"
              placeholder="Channel name or network"
              className="border-border bg-bg h-11 w-full rounded-[8px] border px-3 text-sm"
            />
          </div>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="b-filters"
            onClick={() => setFiltersOpen((o) => !o)}
            className="bg-surface-raised border-border h-11 shrink-0 rounded-[8px] border px-4 text-sm font-semibold sm:hidden"
          >
            {filterCount ? `Filters (${filterCount})` : 'Filters'}
          </button>
        </div>
        <div
          id="b-filters"
          className={`${filtersOpen ? 'grid' : 'hidden'} grid-cols-2 gap-3 sm:grid sm:grid-cols-4`}
        >
          <FacetCombobox
            id="b-country"
            label="Country"
            all="All countries"
            value={filters.country}
            valueName={filters.country && facetName('country', filters.country)}
            options={optionsFor(facets.countries, counts?.countries)}
            onChange={(v) => set({ country: v })}
          />
          <FacetCombobox
            id="b-cat"
            label="Category"
            all="All categories"
            value={filters.category}
            valueName={filters.category && facetName('category', filters.category)}
            options={optionsFor(facets.categories, counts?.categories)}
            onChange={(v) => set({ category: v })}
          />
          <FacetCombobox
            id="b-lang"
            label="Language"
            all="All languages"
            value={filters.language}
            valueName={filters.language && facetName('language', filters.language)}
            options={optionsFor(facets.languages, counts?.languages)}
            onChange={(v) => set({ language: v })}
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="b-status" className="text-text-muted text-xs font-medium">
              Show
            </label>
            <select
              id="b-status"
              value={filters.status ?? ''}
              onChange={(e) => set({ status: e.target.value || undefined })}
              className="border-border bg-bg h-11 w-full min-w-0 rounded-[8px] border px-2.5 text-sm"
            >
              <option value="">All channels{statusCount()}</option>
              {(Object.keys(STATUS_LABEL) as ChannelStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                  {statusCount(s)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>

      {(active.length > 0 || filters.q || filters.status) && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.q && (
            <Chip
              label={`Search: ${filters.q}`}
              onRemove={() => {
                setTerm('');
                set({ q: undefined });
              }}
            />
          )}
          {filters.status && (
            <Chip
              label={`Show: ${STATUS_LABEL[filters.status]}`}
              onRemove={() => set({ status: undefined })}
            />
          )}
          {active.map((k) => (
            <Chip
              key={k}
              label={`${LABELS[k]}: ${facetName(k, filters[k]!)}`}
              onRemove={() => set({ [k]: undefined })}
            />
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-text-muted h-8 px-2.5 text-[13px] underline"
          >
            Clear all
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="border-border flex flex-col items-center gap-3 rounded-[12px] border p-10 text-center">
          <p className="text-lg font-semibold">No channels match these filters</p>
          <p className="text-text-muted text-sm">Try a different country, category or language.</p>
          <button
            type="button"
            onClick={clearAll}
            className="bg-surface-raised mt-2 h-11 rounded-[8px] px-5 text-sm font-semibold"
          >
            Show all channels
          </button>
        </div>
      ) : (
        <div aria-busy={pending} className={pending ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
          <VirtualGrid
            // Remount per filter set: the grid measures its page offset once, and the chips row above it changes.
            key={JSON.stringify(filters)}
            items={items}
            loadingMore={query.isFetchingNextPage}
            languageNames={Object.fromEntries(facets.languages.map((l) => [l.id, l.name]))}
          />
        </div>
      )}

      {query.hasNextPage && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="border-border bg-surface h-12 rounded-[8px] border px-7 text-[15px] font-semibold"
          >
            {query.isFetchingNextPage ? 'Loading…' : 'Load more channels'}
          </button>
        </div>
      )}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove(): void }) {
  return (
    <span className="bg-surface-raised flex h-8 items-center gap-1.5 rounded-full pr-1 pl-3 text-[13px] font-medium">
      {label}
      <button
        type="button"
        aria-label={`Remove filter ${label}`}
        onClick={onRemove}
        className="flex size-6 items-center justify-center rounded-full"
      >
        <CloseIcon size={14} />
      </button>
    </span>
  );
}

/** Virtualized by rows: thousands of cards stay smooth. Columns follow the container width. */
function VirtualGrid({
  items,
  loadingMore,
  languageNames,
}: {
  items: ChannelList['items'];
  loadingMore: boolean;
  languageNames: Record<string, string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);
  const [offset, setOffset] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      setWidth(el.clientWidth);
      setOffset(el.getBoundingClientRect().top + window.scrollY);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const cols = Math.max(1, Math.floor((width + GAP) / (MIN_CARD + GAP)));
  const rows = Math.ceil(items.length / cols) + (loadingMore ? 1 : 0);
  const rowHeight = ((width - GAP * (cols - 1)) / cols - 22) * (9 / 16) + 22 + 70 + GAP;

  const virtualizer = useWindowVirtualizer({
    count: rows,
    estimateSize: () => rowHeight,
    overscan: 3,
    scrollMargin: offset,
  });
  useEffect(() => virtualizer.measure(), [rowHeight, virtualizer]);

  return (
    <div
      ref={ref}
      role="list"
      aria-label="Channels"
      className="relative"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((row) => {
        const slice = items.slice(row.index * cols, row.index * cols + cols);
        return (
          <div
            key={row.key}
            className="absolute inset-x-0 grid"
            style={{
              top: row.start - virtualizer.options.scrollMargin,
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gap: GAP,
            }}
          >
            {slice.length
              ? slice.map((c) => (
                  <div role="listitem" key={c.id}>
                    <ChannelCard
                      channel={c}
                      lineup={items}
                      variant="grid"
                      meta={channelMeta(c, languageNames)}
                    />
                  </div>
                ))
              : Array.from({ length: cols }, (_, i) => <ChannelCardSkeleton key={i} variant="grid" />)}
          </div>
        );
      })}
    </div>
  );
}
