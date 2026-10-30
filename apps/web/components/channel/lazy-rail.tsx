'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import { ChannelRail, RAIL_ITEMS, RailHeader } from './channel-rail';

/** Start loading this far before the rail scrolls into view, so it's ready when it arrives. */
const LOAD_AHEAD = '800px 0px';

/**
 * A category rail that fetches its channels when scrolled near. The home page has 30-odd rails: building them all
 * up front cost phones several seconds. The heading and "See all" link stay in the server HTML; the box keeps the
 * rail's height so the page doesn't jump.
 */
export function LazyRail({
  category,
  title,
  languageNames,
}: {
  category: string;
  title: string;
  languageNames: Record<string, string>;
}) {
  const ref = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => entry?.isIntersecting && setNear(true), {
      rootMargin: LOAD_AHEAD,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const { data } = useQuery({
    queryKey: ['rail', category],
    queryFn: () => api.channels({ category, status: 'live', sort: 'best', limit: RAIL_ITEMS }),
    enabled: near,
    staleTime: 5 * 60_000,
  });
  const seeAllHref = `/category/${category}`;
  if (data) {
    return (
      <ChannelRail title={title} items={data.items} seeAllHref={seeAllHref} languageNames={languageNames} />
    );
  }
  return (
    <section ref={ref} aria-label={title} data-lazy-rail>
      <RailHeader title={title} seeAllHref={seeAllHref} />
      <div aria-hidden="true" className="bg-surface mr-4 h-[190px] rounded-[8px] sm:mr-14 sm:h-[212px]" />
    </section>
  );
}
