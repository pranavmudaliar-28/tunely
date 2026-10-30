'use client';

import type { ChannelStatus } from '@tunely/shared';
import { useState } from 'react';
import { monogram, tint } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Logo on a neutral 16:9 tile; tinted monogram when there is no logo or it fails to load. */
export function ChannelLogo({
  id,
  name,
  logo,
  className,
  children,
  eager,
}: {
  id: string;
  name: string;
  logo: string | null;
  className?: string;
  children?: React.ReactNode;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showLogo = logo && !failed;
  return (
    <span
      className={cn(
        'relative flex aspect-video items-center justify-center overflow-hidden rounded-[8px]',
        className,
      )}
      style={{
        background: showLogo
          ? 'radial-gradient(120% 90% at 50% 40%, color-mix(in srgb, var(--surface-raised) 94%, #ffffff 6%), var(--surface))'
          : tint(id),
      }}
    >
      {showLogo ? (
        // Plain <img>: logos come from many third-party hosts, and routing them through the
        // Next image optimizer would turn it into an open fetch proxy.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          // Eager logos are the page's largest image: fetch them first. Keep async decoding: sync doubled desktop
          // render delay on large logos (measured) and didn't help phones.
          fetchPriority={eager ? 'high' : undefined}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-3/5 w-3/5 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none"
        />
      ) : (
        <span aria-hidden="true" className="text-[34px] font-extrabold">
          {monogram(name)}
        </span>
      )}
      {children}
    </span>
  );
}

const DEAD_LABEL: Record<Exclude<ChannelStatus, 'live'>, string> = {
  offline: 'OFFLINE',
  no_stream: 'NO STREAM',
  closed: 'CLOSED',
};

/** LIVE in red, or a grey label for channels that can't play right now. Stored snapshots may lack a status: treat as live. */
export function LiveBadge({ className, status = 'live' }: { className?: string; status?: ChannelStatus }) {
  const live = status === 'live';
  return (
    <span
      className={cn(
        'absolute top-2.5 left-2.5 rounded-[5px] px-2 py-[3px] text-[11px] font-extrabold tracking-[0.08em]',
        live ? 'bg-live text-[#0B0D12]' : 'bg-[#0B0D12E6] text-[#C9D0DD] ring-1 ring-white/15',
        className,
      )}
    >
      {live ? 'LIVE' : DEAD_LABEL[status]}
    </span>
  );
}

export function QualityChip({ quality }: { quality: string | null }) {
  if (!quality) return null;
  return (
    <span className="absolute top-2.5 right-2.5 rounded-[5px] bg-[#0B0D12CC] px-[7px] py-[3px] text-[11px] font-bold text-[#F2F4F8]">
      {quality}
    </span>
  );
}

export function StatusDot({ status, label }: { status: 'online' | 'unstable' | 'offline'; label: string }) {
  const color = status === 'online' ? 'bg-success' : status === 'unstable' ? 'bg-warning' : 'bg-text-muted';
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={cn('size-[7px] rounded-full', color)} />
      {label}
    </span>
  );
}
