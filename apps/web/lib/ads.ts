// Google AdSense configuration. Ads stay off until NEXT_PUBLIC_ADSENSE_CLIENT is set to the
// publisher id from the AdSense dashboard (ca-pub-…), so nothing loads before the site is approved.

export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() || null;

export type AdPlacement = 'home' | 'browse' | 'watch';

/** Ad unit ids per placement (AdSense → Ads → By ad unit), falling back to one shared unit. */
export function adSlot(placement: AdPlacement): string | null {
  const perPlacement = {
    home: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME,
    browse: process.env.NEXT_PUBLIC_ADSENSE_SLOT_BROWSE,
    watch: process.env.NEXT_PUBLIC_ADSENSE_SLOT_WATCH,
  }[placement];
  return perPlacement?.trim() || process.env.NEXT_PUBLIC_ADSENSE_SLOT?.trim() || null;
}

/** "ca-pub-123" → "pub-123", the form ads.txt uses. */
export function publisherId(client: string): string {
  return client.replace(/^ca-/, '');
}
