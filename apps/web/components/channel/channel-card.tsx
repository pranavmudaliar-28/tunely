'use client';

import type { ChannelSummary } from '@tunely/shared';
import Link from 'next/link';
import { channelMeta } from '@/lib/format';
import { preloadHls } from '@/lib/player/attach';
import { usePlayerStore } from '@/lib/player/store';
import { cn } from '@/lib/utils';
import { ChannelLogo, LiveBadge } from './channel-logo';
import { FavoriteButton } from './favorite-button';

export interface CardProps {
  channel: ChannelSummary;
  /** The list this card sits in; channel up/down on the watch page walks it. */
  lineup: ChannelSummary[];
  meta?: string;
  variant?: 'rail' | 'grid';
  eager?: boolean;
}

export function ChannelCard({ channel, lineup, meta, variant = 'rail', eager }: CardProps) {
  const setLineup = usePlayerStore((s) => s.setLineup);
  const live = (channel.status ?? 'live') === 'live';
  const subtitle = meta ?? channelMeta(channel);
  return (
    <div
      className={cn(
        'group relative flex flex-col gap-3',
        variant === 'grid' &&
          'border-border bg-surface hover:border-text-muted/40 rounded-[10px] border p-2.5 transition-colors duration-200',
      )}
    >
      <Link
        href={`/watch/${encodeURIComponent(channel.id)}`}
        onClick={() => setLineup(lineup)}
        // Start downloading the video player once someone heads for a channel, not on every page load.
        data-nav
        onPointerEnter={preloadHls}
        onFocus={preloadHls}
        onTouchStart={preloadHls}
        className="text-text flex flex-col gap-3 rounded-[10px] no-underline"
      >
        <ChannelLogo
          id={channel.id}
          name={channel.name}
          logo={channel.logo}
          eager={eager}
          className={cn(
            // Hover and focus light the tile's edge; nothing moves.
            'ring-text/0 transition-shadow duration-200 group-hover:ring-2 group-hover:ring-text/25 group-has-[a:focus-visible]:ring-2 group-has-[a:focus-visible]:ring-text/40',
            variant === 'grid' && 'rounded-[6px]',
            // Dead channels stay listed but recede: greyed logo, dimmed tile.
            !live && 'opacity-60 grayscale',
          )}
        >
          <LiveBadge status={channel.status} />
        </ChannelLogo>
        <span className="flex flex-col gap-0.5 px-0.5 pr-12">
          <span className="truncate text-[15px] font-medium">{channel.name}</span>
          {/* The quality never truncates; the end of the subtitle gives way instead. */}
          <span className="text-text-muted flex gap-1 text-[13px]">
            <span className="truncate">{subtitle}</span>
            {/* Grid cards are too narrow for country, language and quality; the language matters more there. */}
            {live && channel.quality && variant === 'rail' && (
              <span className="shrink-0 tabular-nums">· {channel.quality}</span>
            )}
          </span>
        </span>
      </Link>
      <FavoriteButton
        channel={channel}
        className={cn('absolute right-0', variant === 'grid' ? 'right-1.5 bottom-2' : 'bottom-0')}
        compact
      />
    </div>
  );
}

export function ChannelCardSkeleton({ variant = 'rail' }: { variant?: 'rail' | 'grid' }) {
  return (
    <div
      aria-hidden="true"
      className={cn('flex flex-col gap-3', variant === 'grid' && 'border-border rounded-[8px] border p-2.5')}
    >
      <span className="bg-surface-raised aspect-video animate-pulse rounded-[8px]" />
      <span className="bg-surface-raised h-4 w-2/3 animate-pulse rounded" />
      <span className="bg-surface-raised h-3 w-1/2 animate-pulse rounded" />
    </div>
  );
}
