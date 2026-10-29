'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { countryName } from '@/lib/format';
import { ChannelRail } from './channel-rail';

/** Fewer live channels than this and the row isn't worth showing. */
const MIN_ITEMS = 4;

async function loadLocal(skip: string) {
  const { country } = (await fetch('/geo').then((r) => r.json())) as { country: string | null };
  if (!country || country === skip) return null;
  const list = await api.channels({ country, status: 'live', sort: 'best', limit: 12 });
  return list.items.length >= MIN_ITEMS ? { country, items: list.items } : null;
}

/**
 * "Popular in {your country}" for visitors outside the country the server already features. Loaded in the browser so
 * the home page stays one cached page for everyone.
 */
export function LocalRail({
  featuredCountry,
  languageNames,
}: {
  featuredCountry: string;
  languageNames: Record<string, string>;
}) {
  const { data } = useQuery({
    queryKey: ['local-rail', featuredCountry],
    queryFn: () => loadLocal(featuredCountry),
    staleTime: 10 * 60_000,
    retry: false,
  });
  if (!data) return null;
  return (
    <ChannelRail
      title={`Popular in ${countryName(data.country)}`}
      items={data.items}
      seeAllHref={`/country/${data.country.toLowerCase()}`}
      languageNames={languageNames}
      eager
    />
  );
}
