'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { ADSENSE_CLIENT, ADSTERRA, adSlot, adsterraDoc, type AdPlacement } from '@/lib/ads';
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

  if ((!ADSENSE_CLIENT || !slot) && (ADSTERRA.wide || ADSTERRA.narrow)) {
    return <AdsterraBanner className={className} />;
  }

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

const WIDE = '(min-width: 760px)';
const subscribeWide = (cb: () => void) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

/** One Adsterra banner sized for the screen (only the visible size loads, so no hidden impressions). */
function AdsterraBanner({ className }: { className?: string }) {
  const pathname = usePathname();
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => null,
  );
  if (wide === null) return null;
  const pick =
    wide && ADSTERRA.wide
      ? { key: ADSTERRA.wide, w: 728, h: 90 }
      : ADSTERRA.narrow
        ? { key: ADSTERRA.narrow, w: 320, h: 50 }
        : null;
  if (!pick) return null;
  return (
    <aside aria-label="Advertisement" className={cn('flex flex-col items-center gap-1', className)}>
      <span className="text-text-muted self-start text-[11px] tracking-wide uppercase">Advertisement</span>
      <iframe
        // A fresh banner per page.
        key={pathname}
        title="Advertisement"
        width={pick.w}
        height={pick.h}
        srcDoc={adsterraDoc(pick.key, pick.w, pick.h)}
        // Adsterra serves nothing without same-origin (tested), so this is no stronger than AdSense's in-page
        // script; it still keeps the ad's globals and document.write out of our page and opens clicks in a new tab.
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        scrolling="no"
        loading="lazy"
        className="max-w-full border-0"
      />
    </aside>
  );
}
