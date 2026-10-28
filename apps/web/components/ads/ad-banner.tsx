'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { ADSENSE_CLIENT, adSlot, type AdPlacement } from '@/lib/ads';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * A responsive AdSense display banner. Never placed on or over video (AdSense policy).
 * Space is reserved up front so the page doesn't jump when the ad loads.
 */
export function AdBanner({ placement, className }: { placement: AdPlacement; className?: string }) {
  const slot = adSlot(placement);
  const pathname = usePathname();
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!ADSENSE_CLIENT || !slot || !ref.current || ref.current.dataset.adsbygoogleStatus) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Ad blockers and unfilled slots are normal; the page carries on without the ad.
    }
  }, [slot, pathname]);

  if (!ADSENSE_CLIENT || !slot) {
    // Development only: show where ads will go once AdSense is configured.
    if (process.env.NODE_ENV === 'production') return null;
    return (
      <div
        className={cn(
          'border-border text-text-muted flex min-h-[100px] items-center justify-center rounded-[10px] border border-dashed text-xs',
          className,
        )}
      >
        Ad slot: {placement} (set NEXT_PUBLIC_ADSENSE_CLIENT and an ad unit id)
      </div>
    );
  }

  return (
    <aside aria-label="Advertisement" className={cn('flex flex-col gap-1', className)}>
      <span className="text-text-muted text-[11px] tracking-wide uppercase">Advertisement</span>
      <ins
        // A new <ins> per page: AdSense fills each element once.
        key={pathname}
        ref={ref}
        className="adsbygoogle block min-h-[100px] w-full overflow-hidden sm:min-h-[90px]"
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
