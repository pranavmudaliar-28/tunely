'use client';

import type { ChannelSummary } from '@tunely/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { ChannelLogo } from '@/components/channel/channel-logo';
import { SearchIcon } from '@/components/ui/icons';
import { api } from '@/lib/api-client';
import { channelMeta } from '@/lib/format';
import { usePlayerStore } from '@/lib/player/store';

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

  const { data, isFetching } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api.channels({ q: debounced, limit: 8 }, { cache: 'no-store' } as never),
    enabled: debounced.length > 0,
    staleTime: 60_000,
  });
  const results: ChannelSummary[] = debounced ? (data?.items ?? []) : [];

  useEffect(() => {
    const open = () => {
      if (dialog.current?.open) return;
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
    return () => window.removeEventListener('keydown', onKey);
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
        {!debounced && <li className="text-text-muted p-4 text-sm">Type a channel name. Enter opens it.</li>}
      </ul>
    </dialog>
  );
}
