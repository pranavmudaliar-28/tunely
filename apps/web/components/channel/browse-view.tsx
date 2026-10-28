'use client';

import type { ChannelList, Facet } from '@tunely/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CloseIcon } from '@/components/ui/icons';
import { api, type ChannelFilters } from '@/lib/api-client';
import { channelMeta } from '@/lib/format';
import { ChannelCard, ChannelCardSkeleton } from './channel-card';

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

export function browseHref(f: Omit<ChannelFilters, 'cursor' | 'limit'>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) params.set(k, v);
  const qs = params.toString();
  return `/browse${qs ? `?${qs}` : ''}`;
}

export function BrowseView({
  filters,
  firstPage,
  facets,
}: {
  filters: ChannelFilters;
  firstPage: ChannelList;
  facets: BrowseFacets;
}) {
  const router = useRouter();
  const set = (patch: Partial<Record<FilterKey | 'q', string | undefined>>) =>
    router.push(browseHref({ ...filters, ...patch }), { scroll: false });

  const query = useInfiniteQuery({
    queryKey: ['browse', filters],
    queryFn: ({ pageParam }) =>
      api.channels({ ...filters, cursor: pageParam, limit: PAGE }, { cache: 'no-store' } as never),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialData: { pages: [firstPage], pageParams: [undefined] },
  });
  const items = useMemo(() => query.data.pages.flatMap((p) => p.items), [query.data]);

  const facetName = (key: FilterKey, id: string) => {
    const list =
      key === 'country' ? facets.countries : key === 'category' ? facets.categories : facets.languages;
    return list.find((f) => f.id === id)?.name ?? id;
  };
  const active = (Object.keys(LABELS) as FilterKey[]).filter((k) => filters[k]);

  return (
    <div className="flex flex-col gap-6">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          set({ q: new FormData(e.currentTarget).get('q')?.toString().trim() || undefined });
        }}
        className="border-border bg-surface flex flex-wrap items-end gap-3 rounded-[12px] border p-4"
      >
        <div className="flex grow-[2] basis-60 flex-col gap-1.5">
          <label htmlFor="b-q" className="text-text-muted text-xs font-medium">
            Search
          </label>
          <input
            id="b-q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Channel name"
            className="border-border bg-bg h-11 rounded-[8px] border px-3 text-sm"
          />
        </div>
        <FacetSelect
          id="b-country"
          label="Country"
          all="All countries"
          value={filters.country}
          options={facets.countries}
          onChange={(v) => set({ country: v })}
        />
        <FacetSelect
          id="b-cat"
          label="Category"
          all="All categories"
          value={filters.category}
          options={facets.categories}
          onChange={(v) => set({ category: v })}
        />
        <FacetSelect
          id="b-lang"
          label="Language"
          all="All languages"
          value={filters.language}
          options={facets.languages}
          onChange={(v) => set({ language: v })}
        />
        <button
          type="submit"
          className="bg-surface-raised border-border h-11 rounded-[8px] border px-5 text-sm font-semibold"
        >
          Search
        </button>
      </form>

      {(active.length > 0 || filters.q) && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.q && <Chip label={`Search: ${filters.q}`} onRemove={() => set({ q: undefined })} />}
          {active.map((k) => (
            <Chip
              key={k}
              label={`${LABELS[k]}: ${facetName(k, filters[k]!)}`}
              onRemove={() => set({ [k]: undefined })}
            />
          ))}
          <button
            type="button"
            onClick={() => router.push('/browse')}
            className="text-text-muted h-8 px-2.5 text-[13px] underline"
          >
            Clear all
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="border-border flex flex-col items-center gap-3 rounded-[12px] border p-10 text-center">
          <p className="text-lg font-semibold">No channels are playing for these filters right now</p>
          <p className="text-text-muted text-sm">
            We only list channels that passed a health check in the last few hours.
          </p>
          <button
            type="button"
            onClick={() => router.push('/browse')}
            className="bg-surface-raised mt-2 h-11 rounded-[8px] px-5 text-sm font-semibold"
          >
            Show all channels
          </button>
        </div>
      ) : (
        <VirtualGrid
          items={items}
          loadingMore={query.isFetchingNextPage}
          languageNames={Object.fromEntries(facets.languages.map((l) => [l.id, l.name]))}
        />
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

function FacetSelect(props: {
  id: string;
  label: string;
  all: string;
  value?: string;
  options: Facet[];
  onChange(v?: string): void;
}) {
  return (
    <div className="flex grow basis-40 flex-col gap-1.5">
      <label htmlFor={props.id} className="text-text-muted text-xs font-medium">
        {props.label}
      </label>
      <select
        id={props.id}
        value={props.value ?? ''}
        onChange={(e) => props.onChange(e.target.value || undefined)}
        className="border-border bg-bg h-11 rounded-[8px] border px-2.5 text-sm"
      >
        <option value="">{props.all}</option>
        {props.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} ({o.count})
          </option>
        ))}
      </select>
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
