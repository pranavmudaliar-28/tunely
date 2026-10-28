'use client';

import Link from 'next/link';
import { useLibrary } from '@/lib/storage/library';
import { timeAgo } from '@/lib/format';
import { usePlayerStore } from '@/lib/player/store';
import { ChannelLogo, LiveBadge } from './channel-logo';

export function ContinueWatching() {
  const { history } = useLibrary();
  const setLineup = usePlayerStore((s) => s.setLineup);
  if (!history.length) return null;
  const items = history.slice(0, 12);
  return (
    <section aria-labelledby="continue">
      <h2 id="continue" className="pb-3.5 text-xl font-bold">
        Continue watching
      </h2>
      <ul className="flex snap-x gap-3.5 overflow-x-auto pr-4 pb-1.5 sm:pr-14">
        {items.map(({ channel, lastWatchedAt }) => (
          <li key={channel.id} className="w-[260px] shrink-0 snap-start sm:w-[300px]">
            <Link
              href={`/watch/${encodeURIComponent(channel.id)}`}
              onClick={() => setLineup(items.map((h) => h.channel))}
              className="text-text flex flex-col gap-2.5 no-underline"
            >
              <ChannelLogo id={channel.id} name={channel.name} logo={channel.logo}>
                <LiveBadge />
              </ChannelLogo>
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{channel.name}</span>
                <span className="text-text-muted text-[13px]" suppressHydrationWarning>
                  {timeAgo(lastWatchedAt)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
