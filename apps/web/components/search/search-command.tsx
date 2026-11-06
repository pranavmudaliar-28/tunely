'use client';

import { hasFilters, parseQuery, type ChannelSummary } from '@tunely/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { ChannelLogo } from '@/components/channel/channel-logo';
import { SearchIcon } from '@/components/ui/icons';
import { api } from '@/lib/api-client';
import { channelMeta } from '@/lib/format';
import { usePlayerStore } from '@/lib/player/store';
import { searchDictionary } from '@/lib/search-dictionary';

const OPEN_EVENT = 'tunely:search';

/** Opens the palette from phones and TVs, which have no Ctrl+K. */
export function SearchButton({ rail = false }: { rail?: boolean }) {
  return (
    <button
      type="button"
      data-nav={rail || undefined}
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      aria-label={rail ? undefined : 'Search channels'}
      className={
        rail
          ? 'text-text-muted hover:text-text hidden min-h-11 w-[72px] flex-col items-center justify-center gap-1 rounded-[10px] py-2 text-[11px] font-medium min-[720px]:flex'
          : 'text-text-muted hover:text-text flex size-11 items-center justify-center rounded-[10px]'
      }
    >
      <SearchIcon />
      {rail && 'Search'}
    </button>
  );
}

/** Cmd/Ctrl+K palette. A native <dialog> gives focus trapping and Esc for free. */
export function SearchCommand() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const setLineup = usePlayerStore((s) => s.setLineup);
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 200);
    return () => clearTimeout(t);
  }, [term]);

  // Names smart search recognises; loaded the first time the palette opens, not on every page.
  const [opened, setOpened] = useState(false);
  const { data: dict } = useQuery({
    queryKey: ['search-dictionary'],
    queryFn: async () => {
      const [categories, languages, countries] = await Promise.all([
        api.categories(),
        api.languages(),
        api.countries(),
      ]);
      return {
        dictionary: searchDictionary({ categories, languages, countries }),
        categories,
        languages,
        countries,
      };
    },
    enabled: opened,
    staleTime: Infinity,
    retry: false,
  });

  const { data, isFetching } = useQuery({
    queryKey: ['search', debounced, Boolean(dict)],
    queryFn: async () => {
      // "tamil news" → Tamil news channels, best first; falls back to names when the filters find nothing.
      const parsed = dict ? parseQuery(debounced, dict.dictionary) : null;
      if (parsed && hasFilters(parsed)) {
        const { category, language, country, rest } = parsed;
        const smart = await api.channels(
          { q: rest || undefined, category, language, country, sort: 'best', limit: 8 },
          { cache: 'no-store' } as never,
        );
        if (smart.items.length) {
          const name = (list: { id: string; name: string }[], id?: string) =>
            list.find((f) => f.id === id)?.name;
          const label = [
            name(dict!.languages, language),
            name(dict!.categories, category),
            name(dict!.countries, country),
            rest && `“${rest}”`,
          ]
            .filter(Boolean)
            .join(' · ');
          return { items: smart.items, label };
        }
      }
      const plain = await api.channels({ q: debounced, limit: 8 }, { cache: 'no-store' } as never);
      return { items: plain.items, label: null };
    },
    enabled: debounced.length > 0,
    staleTime: 60_000,
  });
  const results: ChannelSummary[] = debounced ? (data?.items ?? []) : [];

  useEffect(() => {
    const open = () => {
      if (dialog.current?.open) return;
      setOpened(true);
      dialog.current?.showModal();
      input.current?.select();
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_EVENT, open);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_EVENT, open);
    };
  }, []);

  function choose(c: ChannelSummary) {
    setLineup(results);
    dialog.current?.close();
    setTerm('');
    router.push(`/watch/${encodeURIComponent(c.id)}`);
  }

  return (
    <dialog
      ref={dialog}
      aria-label="Search channels"
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
      className="bg-surface-raised text-text border-border m-auto mt-[10vh] w-[min(640px,calc(100vw-32px))] rounded-[12px] border p-0 backdrop:bg-black/60"
    >
      <div className="border-border flex items-center gap-3 border-b px-4">
        <SearchIcon className="text-text-muted" />
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
          aria-label="Search channels"
          placeholder="Search channels"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && results[active]) {
              e.preventDefault();
              choose(results[active]);
            }
          }}
          className="h-14 grow bg-transparent text-base outline-none"
        />
        <kbd className="text-text-muted hidden text-xs sm:block">Esc</kbd>
      </div>
      {debounced && data?.label && (
        <p className="text-text-muted px-4 pt-3 text-[13px]" aria-live="polite">
          Showing {data.label}
        </p>
      )}
      <ul id={listId} role="listbox" aria-label="Results" className="max-h-[60vh] overflow-y-auto p-2">
        {results.map((c, i) => (
          <li
            key={c.id}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onClick={() => choose(c)}
            onMouseMove={() => setActive(i)}
            className={`flex cursor-pointer items-center gap-3 rounded-[8px] p-2 ${i === active ? 'bg-surface' : ''}`}
          >
            <ChannelLogo id={c.id} name={c.name} logo={c.logo} className="w-20 shrink-0 [&>span]:text-base" />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{c.name}</span>
              <span className="text-text-muted block truncate text-[13px]">{channelMeta(c)}</span>
            </span>
          </li>
        ))}
        {debounced && !isFetching && results.length === 0 && (
          <li className="text-text-muted p-4 text-sm">No channels match “{debounced}”.</li>
        )}
        {!debounced && (
          <li className="text-text-muted p-4 text-sm">
            Type a channel name, or what you want: “tamil news”, “kids”, “sports uk”. Enter opens it.
          </li>
        )}
      </ul>
    </dialog>
  );
}
