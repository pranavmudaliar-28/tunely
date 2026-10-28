'use client';

import type { Channel, ChannelSummary } from '@tunely/shared';
import { useEffect } from 'react';
import { useNowPlaying } from '@/lib/player/now-playing';

/**
 * The watch page's player box. The video itself is rendered by <GlobalPlayer> in the root layout and
 * positioned over this box, so leaving the page never tears it down. Without a channel (the loading
 * screen) it only holds the place, so the current channel stays put instead of jumping to the corner.
 */
export function PlayerSlot({
  channel,
  fallbackLineup = [],
  meta = '',
}: {
  channel?: Channel;
  fallbackLineup?: ChannelSummary[];
  meta?: string;
}) {
  const setSlot = useNowPlaying((s) => s.setSlot);
  const play = useNowPlaying((s) => s.play);

  useEffect(() => {
    if (channel) play({ channel, fallbackLineup, meta });
    // A new channel id is a new thing to play; the other props travel with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel?.id, play]);

  return (
    <div
      ref={(el) => {
        setSlot(el);
        return () => setSlot(null);
      }}
      data-player-slot
      className="aspect-video w-full bg-black"
    />
  );
}
