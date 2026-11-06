'use client';

import type { ChannelSummary } from '@tunely/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { nativeLanguageName } from '@/lib/format';
import { type HistoryEntry, useLibrary } from '@/lib/storage/library';
import { ChannelRail, RAIL_ITEMS } from './channel-rail';

/** Fewer different channels watched than this and there's no pattern yet. */
const MIN_HISTORY = 3;
const MIN_ITEMS = 4;

/**
 * The category and language this browser watches most: watch time (at least a minute per channel), fading by 10% a
 * day so this week counts more than last month. Computed here; nothing leaves the device.
 */
export function topInterest(
  history: HistoryEntry[],
  now = Date.now(),
): { category?: string; language?: string } | null {
  if (history.length < MIN_HISTORY) return null;
  const categories = new Map<string, number>();
  const languages = new Map<string, number>();
  const add = (m: Map<string, number>, keys: string[], w: number) =>
    keys.forEach((k) => m.set(k, (m.get(k) ?? 0) + w / keys.length));
  for (const h of history) {
    const days = Math.max(0, (now - h.lastWatchedAt) / 86_400_000);
    const w = Math.max(h.watchSeconds, 60) * 0.9 ** days;
    add(categories, h.channel.categories, w);
    add(languages, h.channel.languages, w);
  }
  const top = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1])[0]?.[0];
  const interest = { category: top(categories), language: top(languages) };
  return interest.category || interest.language ? interest : null;
}

/** "For you" on Home: live channels like the ones watched most, minus the ones already watched. */
export function ForYouRail({
  languageNames,
  categoryNames,
}: {
  languageNames: Record<string, string>;
  categoryNames: Record<string, string>;
}) {
  const { history } = useLibrary();
  const interest = topInterest(history);
  const { data } = useQuery({
    queryKey: ['for-you', interest?.category, interest?.language],
    queryFn: async () => {
      const { category, language } = interest!;
      const find = (f: { category?: string; language?: string }) =>
        api.channels({ ...f, status: 'live', sort: 'best', limit: RAIL_ITEMS * 2 }).then((r) => r.items);
      // Both together first; then the category alone, which is usually the stronger habit.
      if (category && language) {
        const items = await find({ category, language });
        if (items.length >= MIN_ITEMS + MIN_HISTORY) return { items, category, language };
      }
      return {
        items: await find(category ? { category } : { language }),
        category,
        language: category ? undefined : language,
      };
    },
    enabled: interest !== null,
    staleTime: 10 * 60_000,
    retry: false,
  });

  if (!data) return null;
  const seen = new Set(history.map((h) => h.channel.id));
  const items: ChannelSummary[] = data.items.filter((c) => !seen.has(c.id)).slice(0, RAIL_ITEMS);
  if (items.length < MIN_ITEMS) return null;
  const what = [
    data.category && (categoryNames[data.category] ?? data.category),
    data.language && `in ${nativeLanguageName(data.language, languageNames[data.language] ?? data.language)}`,
  ]
    .filter(Boolean)
    .join(' ');
  return <ChannelRail title={`For you: more ${what}`} items={items} languageNames={languageNames} />;
}
