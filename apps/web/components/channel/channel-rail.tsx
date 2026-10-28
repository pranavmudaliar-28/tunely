'use client';

import type { ChannelSummary } from '@tunely/shared';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from '@/components/ui/icons';
import { channelMeta } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ChannelCard } from './channel-card';

/** Horizontal channel row. Prev/next buttons sit on the row's edges and only show when there is more to scroll. */
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
  const headingId = useId();
  if (!items.length) return null;
  return (
    <section
      aria-labelledby={headingId}
      // Many rails on the home page: let the browser skip rendering the ones far off-screen.
      className="[contain-intrinsic-size:auto_300px] [content-visibility:auto]"
    >
      <div className="flex items-baseline gap-3 pr-4 pb-3.5 sm:pr-14">
        <h2 id={headingId} className="text-xl font-bold">
          {title}
        </h2>
        <span className="grow" />
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="text-text-muted hover:text-text text-sm font-semibold no-underline"
          >
            See all <span aria-hidden="true">›</span>
          </Link>
        )}
      </div>
      <Scroller label={title}>
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
      </Scroller>
    </section>
  );
}

/** Scrollable row with edge buttons, shared by every rail. Touch, trackpad and Tab scroll it too. */
export function Scroller({
  label,
  children,
  list,
  buttonTop = 79,
}: {
  label: string;
  children: React.ReactNode;
  /** Children are role="listitem" elements. */
  list?: boolean;
  /** Vertical centre of the edge buttons in px (default: centre of a 280 px wide 16:9 thumbnail). */
  buttonTop?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  const edgeButton = (dir: 1 | -1) => {
    const hidden = dir === -1 ? edges.start : edges.end;
    return (
      <button
        type="button"
        aria-label={`Scroll ${label} ${dir === -1 ? 'left' : 'right'}`}
        onClick={() => scrollBy(dir)}
        tabIndex={hidden ? -1 : 0}
        aria-hidden={hidden}
        style={{ top: buttonTop }}
        className={cn(
          'bg-surface-raised/90 text-text border-border absolute z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border shadow-lg shadow-black/40 backdrop-blur transition duration-200 hover:scale-110 md:flex',
          dir === -1 ? '-left-3' : 'right-8',
          hidden && 'pointer-events-none opacity-0',
        )}
      >
        {dir === -1 ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
      </button>
    );
  };

  return (
    <div className="relative">
      {edgeButton(-1)}
      <div
        ref={ref}
        onScroll={update}
        role={list ? 'list' : undefined}
        aria-label={list ? label : undefined}
        className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto pr-4 pb-2 sm:pr-14"
      >
        {children}
      </div>
      {edgeButton(1)}
    </div>
  );
}
