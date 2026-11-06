'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '@/lib/api-client';
import { backOnline, refreshFavorites, useLibrary } from '@/lib/storage/library';
import { ChannelRail, RAIL_ITEMS } from './channel-rail';

/** The API takes up to 50 ids per request. */
const MAX_IDS = 50;

/**
 * Favorites on the home page, live ones first, with today's status. "Back online" marks favorites that were not live
 * on the last visit; their stored snapshot is then updated, so the note shows once per comeback.
 */
export function YourChannels({ languageNames }: { languageNames: Record<string, string> }) {
  const { favorites } = useLibrary();
  const ids = favorites.slice(0, MAX_IDS).map((c) => c.id);
  const { data } = useQuery({
    queryKey: ['your-channels', ids.join(',')],
    queryFn: async () => {
      const { items } = await api.channels({ ids: ids.join(','), limit: ids.length }, {
        cache: 'no-store',
      } as never);
      const back = backOnline(favorites, items);
      void refreshFavorites(items);
      return { items, back };
    },
    enabled: ids.length > 0,
    // Once per page view: a refetch would compare against the snapshot just updated and drop the notes.
    staleTime: Infinity,
    retry: false,
  });

  const items = useMemo(() => {
    const fresh = new Map(data?.items.map((c) => [c.id, c]));
    const list = favorites.slice(0, MAX_IDS).map((c) => fresh.get(c.id) ?? c);
    const live = (c: { status?: string }) => ((c.status ?? 'live') === 'live' ? 0 : 1);
    return list.sort((a, b) => live(a) - live(b)).slice(0, RAIL_ITEMS);
  }, [favorites, data]);

  return (
    <ChannelRail
      title="Your channels"
      items={items}
      seeAllHref="/favorites"
      languageNames={languageNames}
      note={(c) => (data?.back.has(c.id) ? 'Back online' : undefined)}
      eager
    />
  );
}
