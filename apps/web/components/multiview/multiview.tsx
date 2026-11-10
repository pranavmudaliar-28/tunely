'use client';

import type { ChannelSummary } from '@tunely/shared';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChannelLogo } from '@/components/channel/channel-logo';
import { api } from '@/lib/api-client';
import { MAX_TILES, parseTiles, tilesHref } from '@/lib/multiview';
import { useNowPlaying } from '@/lib/player/now-playing';
import { useLibrary } from '@/lib/storage/library';
import { cn } from '@/lib/utils';
import { Tile } from './tile';

/** 2–4 channels at once; sound from one. The channels live in the URL, so a layout can be shared or bookmarked. */
export function MultiView() {
  const router = useRouter();
  const ids = parseTiles(useSearchParams().get('c'));
  const [audioPick, setAudio] = useState(0);
  const audio = Math.min(audioPick, Math.max(0, ids.length - 1));
  /** The slot being filled: an existing tile, or ids.length for a new one. */
  const [picking, setPicking] = useState<number | null>(null);
  const channels = useQueries({
    queries: ids.map((id) => ({ queryKey: ['channel', id], queryFn: () => api.channel(id), staleTime: 300_000 })),
  });
  const set = (next: string[]) => router.replace(tilesHref(parseTiles(next.join(','))), { scroll: false });

  // The mini player would play over the tiles.
  const closeMini = useNowPlaying((s) => s.close);
  useEffect(() => closeMini(), [closeMini]);

  // 1–4 choose which tile you hear.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest('input, textarea, dialog')) return;
      const n = Number(e.key);
      if (n >= 1 && n <= ids.length) setAudio(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ids.length]);

  const addButton = (
    <button
      type="button"
      onClick={() => setPicking(ids.length)}
      className="bg-surface-raised hover:bg-border h-11 rounded-[8px] px-4 text-[15px] font-semibold"
    >
      Add a channel
    </button>
  );

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-16 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">Multi-view</h1>
          <p className="text-text-muted text-[15px]">
            Up to {MAX_TILES} channels at once, each at up to 480p. You hear one: choose it with Listen or keys 1–
            {MAX_TILES}.
          </p>
        </div>
        {ids.length > 0 && ids.length < MAX_TILES && addButton}
      </header>
      {ids.length ? (
        <div className={cn('grid gap-4', ids.length > 1 && 'min-[720px]:grid-cols-2')}>
          {ids.map((id, i) => {
            const remove = () => {
              set(ids.filter((x) => x !== id));
              if (audio > i) setAudio(audio - 1);
            };
            const q = channels[i]!;
            if (!q.data)
              return (
                <div
                  key={id}
                  className="bg-surface-raised text-text-muted flex aspect-video flex-col items-center justify-center gap-3 rounded-[12px] p-4 text-center text-[15px]"
                >
                  {q.isError ? "This channel couldn't be loaded." : 'Loading…'}
                  {q.isError && (
                    <button type="button" onClick={remove} className="text-text underline">
                      Remove
                    </button>
                  )}
                </div>
              );
            return (
              <Tile
                key={id}
                channel={q.data}
                audio={i === audio}
                onAudio={() => setAudio(i)}
                onChange={() => setPicking(i)}
                onRemove={remove}
              />
            );
          })}
        </div>
      ) : (
        <div className="bg-surface border-border flex flex-col items-start gap-3 rounded-[12px] border p-6">
          <p className="text-[15px]">Pick the first channel. News side by side, or a match while you keep an eye on another.</p>
          {addButton}
        </div>
      )}
      {picking !== null && (
        <Picker
          exclude={ids}
          onPick={(id) => {
            const next = [...ids];
            next[picking] = id;
            set(next);
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}

function Picker({
  exclude,
  onPick,
  onClose,
}: {
  exclude: string[];
  onPick(id: string): void;
  onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => dialog.current?.showModal(), []);
  const [term, setTerm] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(term.trim()), 200);
    return () => clearTimeout(t);
  }, [term]);
  const { favorites, history } = useLibrary();
  const { data, isFetching } = useQuery({
    queryKey: ['multiview-search', q],
    queryFn: () => api.channels({ q, status: 'live', limit: 8 }),
    enabled: q.length > 0,
  });
  const seen = new Set(exclude);
  const fresh = (c: ChannelSummary) => c.status === 'live' && !seen.has(c.id) && seen.add(c.id);
  const items = q
    ? (data?.items ?? []).filter(fresh)
    : [...favorites, ...history.map((h) => h.channel)].filter(fresh).slice(0, 8);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="mv-pick"
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
      className="bg-surface-raised text-text border-border m-auto w-[min(480px,calc(100vw-32px))] rounded-[12px] border p-5 backdrop:bg-black/60"
    >
      <div className="flex items-center justify-between pb-3">
        <h2 id="mv-pick" className="text-lg font-semibold">
          Pick a channel
        </h2>
        <form method="dialog">
          <button type="submit" className="text-text-muted h-11 px-2 text-sm underline">
            Close
          </button>
        </form>
      </div>
      <input
        type="search"
        autoFocus
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        aria-label="Search live channels"
        placeholder="Search live channels"
        className="bg-surface border-border h-11 w-full rounded-[8px] border px-3 text-[15px]"
      />
      {!q && items.length > 0 && <p className="text-text-muted pt-3 text-[13px]">Your favorites and recent channels</p>}
      <ul className="flex max-h-[50vh] flex-col overflow-y-auto pt-2">
        {items.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c.id)}
              className="hover:bg-surface flex w-full items-center gap-3 rounded-[8px] p-2 text-left"
            >
              <ChannelLogo id={c.id} name={c.name} logo={c.logo} className="w-16 shrink-0 [&>span]:text-sm" />
              <span className="truncate text-[15px] font-medium">{c.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {!items.length && (
        <p className="text-text-muted pt-3 text-sm">
          {q ? (isFetching ? 'Searching…' : `No live channel matches “${q}”.`) : 'Search for a channel to add.'}
        </p>
      )}
    </dialog>
  );
}
