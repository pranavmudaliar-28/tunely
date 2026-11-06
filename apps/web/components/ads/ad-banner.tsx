'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { ADSENSE_CLIENT, ADSTERRA, adSlot, adsterraDoc, type AdPlacement } from '@/lib/ads';
import { useNearViewport } from '@/lib/use-near-viewport';
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

  if ((!ADSENSE_CLIENT || !slot) && (ADSTERRA.wide || ADSTERRA.medium || ADSTERRA.narrow)) {
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
      <span className="text-text-muted text-[11px]">Advertisement</span>
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

/** Load an ad only when it's about to be seen: the script runs on the page's own thread. */
const AD_LOAD_AHEAD = '300px 0px';

/** One Adsterra banner sized for the screen (only the visible size loads, so no hidden impressions). */
function AdsterraBanner({ className }: { className?: string }) {
  const pathname = usePathname();
  const [box, near] = useNearViewport<HTMLElement>(AD_LOAD_AHEAD);
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => null,
  );
  if (wide === null) return null;
  const phone = ADSTERRA.medium
    ? { key: ADSTERRA.medium, w: 300, h: 250 }
    : ADSTERRA.narrow
      ? { key: ADSTERRA.narrow, w: 320, h: 50 }
      : null;
  const pick = wide && ADSTERRA.wide ? { key: ADSTERRA.wide, w: 728, h: 90 } : phone;
  if (!pick) return null;
  return (
    <aside ref={box} aria-label="Advertisement" className={cn('flex flex-col items-center gap-1', className)}>
      <span className="text-text-muted self-start text-[11px]">Advertisement</span>
      {/* Same size before and after loading, so the page doesn't jump. */}
      <div style={{ width: pick.w, height: pick.h, maxWidth: '100%' }}>
        {near && (
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
            // Same scheme as the ad's own document, or Chrome paints an empty slot white on our dark page.
            style={{ colorScheme: 'light' }}
            className="max-w-full border-0"
          />
        )}
      </div>
    </aside>
  );
}

/**
 * Adsterra Native Banner: a row of ad cards at the end of a page's content, never on or over video. Unlike the
 * banners it fills a div in the page, so its script runs here; it loads only when near, and only without AdSense.
 */
export function AdNative({ className }: { className?: string }) {
  const pathname = usePathname();
  const [box, near] = useNearViewport<HTMLElement>(AD_LOAD_AHEAD);
  const native = ADSENSE_CLIENT ? null : ADSTERRA.native;
  useEffect(() => {
    if (!near || !native) return;
    const script = document.createElement('script');
    script.async = true;
    script.dataset.cfasync = 'false';
    script.src = native.src;
    document.body.appendChild(script);
    return () => script.remove();
  }, [near, native, pathname]);
  if (!native) return null;
  return (
    <aside ref={box} aria-label="Advertisement" className={cn('flex flex-col gap-1', className)}>
      <span className="text-text-muted text-[11px]">Advertisement</span>
      {/* A fresh container per page: the script fills it once. */}
      <div key={pathname} id={`container-${native.key}`} className="min-h-[160px] w-full" />
    </aside>
  );
}
