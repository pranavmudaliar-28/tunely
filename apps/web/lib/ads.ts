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

const clean = (v: string | undefined, pattern: RegExp) =>
  v?.trim() && pattern.test(v.trim()) ? v.trim() : null;

/**
 * Adsterra banners (Websites → Banner): used only while AdSense isn't configured. Keys go into an iframe document,
 * so they're validated to plain ids.
 */
export const ADSTERRA = {
  wide: clean(process.env.NEXT_PUBLIC_ADSTERRA_KEY_728X90, /^[a-z0-9]{8,64}$/i),
  narrow: clean(process.env.NEXT_PUBLIC_ADSTERRA_KEY_320X50, /^[a-z0-9]{8,64}$/i),
  /** The banner code's script src with the key replaced by {key}; Adsterra uses different hosts per account. */
  script:
    clean(process.env.NEXT_PUBLIC_ADSTERRA_SCRIPT, /^https:\/\/[a-z0-9.-]+\/[\w./-]*\{key\}[\w./-]*$/i) ??
    'https://www.highperformanceformat.com/{key}/invoke.js',
};

/** The HTML Adsterra's banner code expects, to run inside a sandboxed iframe. */
export function adsterraDoc(key: string, width: number, height: number, script = ADSTERRA.script): string {
  const options = JSON.stringify({ key, format: 'iframe', height, width, params: {} });
  return `<!doctype html><html><body style="margin:0;overflow:hidden"><script>atOptions=${options};</script><script src="${script.replace('{key}', key)}"></script></body></html>`;
}

/** "ca-pub-123" → "pub-123", the form ads.txt uses. */
export function publisherId(client: string): string {
  return client.replace(/^ca-/, '');
}
