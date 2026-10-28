'use client';

import type { ChannelSummary } from '@tunely/shared';
import { HeartIcon } from '@/components/ui/icons';
import { toggleFavorite, useIsFavorite } from '@/lib/storage/library';
import { cn } from '@/lib/utils';

export function FavoriteButton({
  channel,
  compact,
  secondary,
  className,
}: {
  channel: ChannelSummary;
  compact?: boolean;
  /** Translucent style for use next to a primary button (home hero). */
  secondary?: boolean;
  className?: string;
}) {
  const on = useIsFavorite(channel.id);
  const label = on ? `Remove ${channel.name} from favorites` : `Add ${channel.name} to favorites`;
  if (compact) {
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={on}
        onClick={() => void toggleFavorite(channel)}
        className={cn(
          'flex size-11 items-center justify-center rounded-full',
          on ? 'text-accent' : 'text-text-muted hover:text-text',
          className,
        )}
      >
        <HeartIcon filled={on} size={20} />
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => void toggleFavorite(channel)}
      className={cn(
        'flex h-12 items-center gap-2 rounded-[8px] px-5 text-[15px] font-bold',
        on
          ? 'bg-surface-raised text-text'
          : secondary
            ? 'bg-text/15 text-text hover:bg-text/25'
            : 'bg-text text-bg',
        className,
      )}
    >
      <HeartIcon filled={on} size={18} className={on ? 'text-accent' : undefined} />
      {on ? 'In favorites' : 'Favorites'}
    </button>
  );
}
