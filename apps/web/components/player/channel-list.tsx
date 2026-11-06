'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { CloseIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

type Item = { id: string; name: string; status?: string };

/**
 * The list the viewer is flipping through, drawn inside the player frame so it works in fullscreen. Opens on the
 * channel that's playing; ↑/↓ move, Enter plays, Esc closes. Never holds ads.
 */
export function ChannelList({
  items,
  currentId,
  onPick,
  onClose,
}: {
  items: Item[];
  currentId: string;
  onPick(id: string): void;
  onClose(): void;
}) {
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const links = list.current?.querySelectorAll<HTMLElement>('a');
    const current = list.current?.querySelector<HTMLElement>('[aria-current="true"]');
    (current ?? links?.[0])?.focus({ preventScroll: false });
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Handled here so the player's own ↑/↓ (change channel) and Esc don't also fire.
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      return onClose();
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    e.stopPropagation();
    const links = [...(list.current?.querySelectorAll<HTMLElement>('a') ?? [])];
    const i = links.indexOf(document.activeElement as HTMLElement);
    const next = (i + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
    links[next]?.focus();
  };

  return (
    <nav
      aria-label="Channels"
      onKeyDown={onKeyDown}
      className="absolute inset-y-0 right-0 z-10 flex w-[min(320px,85%)] flex-col bg-black/85 text-[#F2F4F8]"
    >
      <div className="flex items-center justify-between py-2 pr-2 pl-4">
        <span className="text-[15px] font-semibold">Channels</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close channel list"
          className="flex size-11 items-center justify-center rounded-[8px] hover:bg-white/10"
        >
          <CloseIcon size={20} />
        </button>
      </div>
      <ul ref={list} className="grow overflow-y-auto px-2 pb-3">
        {items.map((c, i) => {
          const current = c.id === currentId;
          const live = (c.status ?? 'live') === 'live';
          return (
            <li key={c.id}>
              <Link
                href={`/watch/${encodeURIComponent(c.id)}`}
                aria-current={current || undefined}
                onClick={(e) => {
                  e.preventDefault();
                  onPick(c.id);
                }}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-[8px] px-2 text-sm text-[#F2F4F8] no-underline hover:bg-white/10',
                  current && 'bg-white/15 font-semibold',
                )}
              >
                <span className="w-6 shrink-0 text-right text-[#9AA3B5] tabular-nums">{i + 1}</span>
                <span className="min-w-0 grow truncate">{c.name}</span>
                {!live && <span className="shrink-0 text-xs text-[#9AA3B5]">Offline</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
