'use client';

import type { ChannelSummary } from '@tunely/shared';
import Link from 'next/link';
import { preloadHls } from '@/lib/player/attach';
import { usePlayerStore } from '@/lib/player/store';
import { ChannelLogo } from './channel-logo';
import { NowNext } from './now-next';

/** One row of the guide: the channel (a single link) beside what's on now and next. */
export function GuideRow({ channel, lineup }: { channel: ChannelSummary; lineup: ChannelSummary[] }) {
  const setLineup = usePlayerStore((s) => s.setLineup);
  return (
    <li className="border-border grid grid-cols-[104px_1fr] items-start gap-4 border-b py-3 last:border-b-0 sm:grid-cols-[152px_1fr]">
      <Link
        data-nav
        href={`/watch/${encodeURIComponent(channel.id)}`}
        onClick={() => setLineup(lineup)}
        onFocus={preloadHls}
        onPointerEnter={preloadHls}
        className="text-text flex flex-col gap-1.5 rounded-[8px] no-underline"
      >
        <ChannelLogo id={channel.id} name={channel.name} logo={channel.logo} />
        <span className="truncate px-0.5 text-[13px] font-medium">{channel.name}</span>
      </Link>
      <NowNext
        schedule={channel.onAir}
        channel={{ id: channel.id, name: channel.name }}
        label={`${channel.name}: on now and next`}
      />
    </li>
  );
}

export function GuideList({ items }: { items: ChannelSummary[] }) {
  return (
    <ul className="flex flex-col">
      {items.map((c) => (
        <GuideRow key={c.id} channel={c} lineup={items} />
      ))}
    </ul>
  );
}
