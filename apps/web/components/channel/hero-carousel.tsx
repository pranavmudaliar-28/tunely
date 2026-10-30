'use client';

import type { ChannelSummary } from '@tunely/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { ChevronLeft, ChevronRight, PauseIcon, PlayIcon } from '@/components/ui/icons';
import { usePlayerStore } from '@/lib/player/store';
import { cn } from '@/lib/utils';
import { ChannelLogo, LiveBadge } from './channel-logo';
import { FavoriteButton } from './favorite-button';

export interface HeroSlide {
  channel: ChannelSummary;
  /** "Best in News", "Most watched now"… */
  label: string;
  meta: string;
}

const ROTATE_MS = 7000;

/**
 * Home hero: the best live channel in each top category. Rotates every 7 s, pauses while hovered or
 * focused and when the viewer prefers reduced motion; arrows, dots and a pause button for control.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const setLineup = usePlayerStore((s) => s.setLineup);
  const count = slides.length;
  const paused = stopped || hovered || focused || reducedMotion;

  const show = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (paused || count < 2) return;
    const t = setTimeout(() => show(index + 1), ROTATE_MS);
    return () => clearTimeout(t);
  }, [index, paused, count, show]);

  const slide = slides[index];
  if (!slide) return null;
  const { channel } = slide;

  return (
    <div
      aria-roledescription="carousel"
      aria-label="Best channels by category"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocused(false)}
      className="relative h-full"
    >
      {/* Big logo card on the right, crossfading between slides. */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 right-[8%] hidden w-[min(34vw,460px)] -translate-y-1/2 lg:block"
      >
        {slides.map((s, i) => (
          <div
            key={s.channel.id}
            className={cn(
              'transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none',
              i === index
                ? 'rotate-[-6deg] opacity-100'
                : 'pointer-events-none absolute inset-0 rotate-[-3deg] scale-95 opacity-0',
            )}
          >
            <ChannelLogo
              id={s.channel.id}
              name={s.channel.name}
              logo={s.channel.logo}
              eager={i === 0}
              className="border-text/15 rounded-[16px] border shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8),0_0_80px_-10px_color-mix(in_srgb,var(--accent)_45%,transparent)]"
            >
              <LiveBadge className="top-4 left-4" />
            </ChannelLogo>
          </div>
        ))}
      </div>

      <div
        key={channel.id}
        role="group"
        aria-roledescription="slide"
        aria-label={`${index + 1} of ${count}: ${channel.name}`}
        aria-live={paused ? 'polite' : 'off'}
        className="animate-in fade-in slide-in-from-bottom-2 relative flex h-full max-w-[680px] flex-col justify-end gap-[18px] px-4 pb-20 duration-500 motion-reduce:animate-none sm:px-14 sm:pb-24"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="bg-live flex items-center gap-1.5 rounded-[6px] px-2.5 py-[5px] text-xs font-extrabold tracking-[0.08em] text-[#0B0D12]">
            <span aria-hidden="true" className="size-[7px] rounded-full bg-[#0B0D12]" />
            LIVE
          </span>
          <span className="text-text-muted text-[13px] font-semibold tracking-[0.08em] uppercase">
            {slide.label}
          </span>
        </div>
        {/* h2: the rotating channel name isn't what the home page is about; the page's h1 is in HomeAbout. */}
        <h2 className="text-5xl leading-none font-extrabold tracking-[-0.03em] sm:text-[72px]">
          {channel.name}
        </h2>
        <p className="text-text-soft flex flex-wrap gap-x-3.5 gap-y-1.5 text-[15px] font-medium">
          {slide.meta}
          {channel.quality && (
            <span className="border-text-muted rounded border px-1.5 text-xs leading-5 font-bold">
              {channel.quality}
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-3 pt-1.5">
          <Link
            href={`/watch/${encodeURIComponent(channel.id)}`}
            onClick={() => setLineup(slides.map((s) => s.channel))}
            className="bg-text text-bg flex h-[52px] items-center gap-2.5 rounded-[8px] px-7 text-[17px] font-bold no-underline"
          >
            <PlayIcon size={20} />
            Watch live
          </Link>
          <FavoriteButton channel={channel} secondary className="h-[52px] px-6 text-[17px]" />
        </div>
      </div>

      {count > 1 && (
        <div className="absolute bottom-6 left-4 flex items-center gap-2 sm:bottom-8 sm:left-14">
          <button
            type="button"
            onClick={() => show(index - 1)}
            aria-label="Previous featured channel"
            className="bg-text/10 hover:bg-text/20 flex size-10 items-center justify-center rounded-full"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center">
            {slides.map((s, i) => (
              <button
                key={s.channel.id}
                type="button"
                onClick={() => show(i)}
                aria-label={`Show ${s.label.toLowerCase()}: ${s.channel.name}`}
                aria-current={i === index}
                className="group/dot flex h-10 items-center px-1"
              >
                <span
                  className={cn(
                    'block h-1 rounded-full transition-all duration-300',
                    i === index ? 'bg-accent w-7' : 'bg-text/30 group-hover/dot:bg-text/60 w-3',
                  )}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => show(index + 1)}
            aria-label="Next featured channel"
            className="bg-text/10 hover:bg-text/20 flex size-10 items-center justify-center rounded-full"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            onClick={() => setStopped((v) => !v)}
            aria-label={stopped ? 'Start rotating featured channels' : 'Stop rotating featured channels'}
            aria-pressed={stopped}
            className="text-text-muted hover:text-text flex size-10 items-center justify-center rounded-full"
          >
            {stopped ? <PlayIcon size={14} /> : <PauseIcon size={16} />}
          </button>
        </div>
      )}
    </div>
  );
}

const REDUCED = '(prefers-reduced-motion: reduce)';
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(REDUCED);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}
