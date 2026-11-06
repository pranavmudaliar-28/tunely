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
          className="h-3/5 w-3/5 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
        />
      ) : (
        <span aria-hidden="true" className="text-text-soft text-3xl font-semibold">
          {monogram(name)}
        </span>
      )}
      {children}
    </span>
  );
}

const DEAD_LABEL: Record<Exclude<ChannelStatus, 'live'>, string> = {
  offline: 'Offline',
  no_stream: 'No stream',
  closed: 'Closed',
};

/**
 * The on-air light: a small red dot for live channels, a quiet grey label for ones that can't play right now.
 * Stored snapshots may lack a status: treat as live.
 */
export function LiveBadge({ className, status = 'live' }: { className?: string; status?: ChannelStatus }) {
  if (status === 'live') {
    return (
      <span className={cn('bg-live absolute top-3 left-3 size-2 rounded-full', className)}>
        <span className="sr-only">Live</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        'absolute top-2 left-2 rounded-[4px] bg-[#0B0D12E6] px-2 py-1 text-[11px] leading-none font-medium text-[#C9D0DD]',
        className,
      )}
    >
      {DEAD_LABEL[status]}
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
