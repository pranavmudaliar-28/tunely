'use client';

import Link from 'next/link';
import { ChannelCard } from '@/components/channel/channel-card';
import { useLibrary } from '@/lib/storage/library';

export function FavoritesView() {
  const { favorites } = useLibrary();
  if (!favorites.length) {
    return (
      <div className="border-border flex flex-col items-center gap-3 rounded-[12px] border p-10 text-center">
        <p className="text-lg font-semibold">No favorites yet</p>
        <p className="text-text-muted text-sm">Tap the heart on any channel to keep it here.</p>
        <Link
          href="/browse"
          className="bg-surface-raised text-text mt-2 flex h-11 items-center rounded-[8px] px-5 text-sm font-semibold no-underline"
        >
          Browse channels
        </Link>
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
      {favorites.map((c) => (
        <li key={c.id}>
          <ChannelCard channel={c} lineup={favorites} variant="grid" />
        </li>
      ))}
    </ul>
  );
}
