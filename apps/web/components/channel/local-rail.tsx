'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { countryName } from '@/lib/format';
import { usePrefs } from '@/lib/prefs';
import { ChannelRail } from './channel-rail';

/** Fewer live channels than this and the row isn't worth showing. */
const MIN_ITEMS = 4;

async function loadLocal(skip: string, chosen: string | undefined) {
  const country =
    chosen ?? ((await fetch('/geo').then((r) => r.json())) as { country: string | null }).country;
  if (!country || country === skip) return null;
  const list = await api.channels({ country, status: 'live', sort: 'best', limit: 12 });
  return list.items.length >= MIN_ITEMS ? { country, items: list.items } : null;
}

/**
 * "Popular in {your country}": the country picked in settings, else the one the connection comes from. Skipped when
 * it is the country the server already features. Loaded in the browser so the home page stays one cached page.
 */
export function LocalRail({
  featuredCountry,
  languageNames,
}: {
  featuredCountry: string;
  languageNames: Record<string, string>;
}) {
  const prefs = usePrefs();
  const { data } = useQuery({
    queryKey: ['local-rail', featuredCountry, prefs?.country],
    queryFn: () => loadLocal(featuredCountry, prefs?.country),
    enabled: prefs !== null,
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
