import type { Metadata } from 'next';
import { FavoritesView } from './favorites-view';

export const metadata: Metadata = { title: 'Your favorites', robots: { index: false } };

export default function FavoritesPage() {
  return (
    <div className="flex flex-col gap-6 px-4 pt-8 pb-16 sm:px-14">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[32px] font-bold tracking-[-0.02em]">Favorites</h1>
        <p className="text-text-muted text-[15px]">Saved in this browser. No account needed.</p>
      </div>
      <FavoritesView />
    </div>
  );
}
