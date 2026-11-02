'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { ADSENSE_CLIENT, ADSTERRA, pageAdsAllowed } from '@/lib/ads';
import { useNowPlaying } from '@/lib/player/now-playing';

const SCRIPTS = ADSENSE_CLIENT ? [] : [ADSTERRA.popunder, ADSTERRA.socialBar].filter((s) => s !== null);
const FIRST_INTERACTION = ['pointerdown', 'scroll', 'keydown'] as const;

let loaded = false;

/**
 * Adsterra Popunder and Social Bar: page-wide scripts that can't be confined to an ad slot and can't be unloaded. To
 * keep "never on or over video", they never load on channel pages or with the mini player, and opening a channel
 * after they've loaded reloads the page without them. They wait for the first interaction so they don't slow the
 * first paint.
 */
export function PageAds() {
  const pathname = usePathname();
  const playing = useNowPlaying((s) => s.now !== null);
  const allowed = pageAdsAllowed(pathname, playing);

  useEffect(() => {
    if (!SCRIPTS.length) return;
    if (!allowed) {
      if (loaded) window.location.reload();
      return;
    }
    if (loaded) return;
    const load = () => {
      loaded = true;
      remove();
      for (const src of SCRIPTS) {
        const script = document.createElement('script');
        script.dataset.cfasync = 'false';
        script.src = src;
        document.body.appendChild(script);
      }
    };
    const remove = () => FIRST_INTERACTION.forEach((e) => window.removeEventListener(e, load));
    FIRST_INTERACTION.forEach((e) => window.addEventListener(e, load, { passive: true }));
    return remove;
  }, [allowed]);

  return null;
}
