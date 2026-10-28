'use client';

import type { ChannelSummary } from '@tunely/shared';
import Link from 'next/link';
import { useId, useRef } from 'react';
import { ChevronLeft, ChevronRight } from '@/components/ui/icons';
import { channelMeta } from '@/lib/format';
import { ChannelCard } from './channel-card';

/** Horizontal row with scroll snap. Arrow buttons on desktop; touch and keyboard (Tab) scroll it everywhere. */
export function ChannelRail({
  title,
  items,
  seeAllHref,
  languageNames,
  eager,
}: {
  title: string;
  items: ChannelSummary[];
  seeAllHref?: string;
  /** language code -> English name, for the card subtitles */
  languageNames?: Record<string, string>;
  eager?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const headingId = useId();
  if (!items.length) return null;
  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
  };
  return (
    <section aria-labelledby={headingId}>
      <div className="flex items-center gap-4 pr-4 pb-3.5 sm:pr-14">
        <h2 id={headingId} className="grow text-xl font-bold">
          {title}
        </h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="text-text-muted hover:text-text text-sm font-semibold no-underline"
          >
            See all <span aria-hidden="true">›</span>
          </Link>
        )}
        <div className="hidden gap-1 md:flex">
          <button
            type="button"
            aria-label={`Scroll ${title} left`}
            onClick={() => scrollBy(-1)}
            className="bg-surface-raised flex size-11 items-center justify-center rounded-full"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            aria-label={`Scroll ${title} right`}
            onClick={() => scrollBy(1)}
            className="bg-surface-raised flex size-11 items-center justify-center rounded-full"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      <div
        ref={scroller}
        className="flex snap-x snap-mandatory scroll-px-4 gap-3.5 overflow-x-auto pr-4 pb-1.5 [scrollbar-width:thin] sm:pr-14"
      >
        {items.map((c, i) => (
          <div key={c.id} className="w-[240px] shrink-0 snap-start sm:w-[280px]">
            <ChannelCard
              channel={c}
              lineup={items}
              meta={channelMeta(c, languageNames)}
              eager={eager && i < 4}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
