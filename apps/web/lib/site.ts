export const SITE_NAME = 'Tunely';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
export const CONTACT_EMAIL = 'pranavmudaliar36@gmail.com';

const httpsUrl = (v: string | undefined) => {
  try {
    return v?.trim() && new URL(v.trim()).protocol === 'https:' ? v.trim() : null;
  } catch {
    return null;
  }
};

/** Donation page (Buy Me a Coffee, Ko-fi, Razorpay…). The Support button is hidden until it's set. */
export const SUPPORT_URL = httpsUrl(process.env.NEXT_PUBLIC_SUPPORT_URL);

/** Affiliate links for the "Watch on TV" page; each block is hidden until its env var is set. */
export const AFFILIATE = {
  /** Amazon Associates tracking id (e.g. tunely-21) and the store it belongs to. */
  amazonTag: process.env.NEXT_PUBLIC_AMAZON_TAG?.trim().match(/^[\w-]{3,40}$/)?.[0] ?? null,
  amazonDomain:
    process.env.NEXT_PUBLIC_AMAZON_DOMAIN?.trim().match(/^amazon\.[a-z.]{2,8}$/)?.[0] ?? 'amazon.in',
  vpnUrl: httpsUrl(process.env.NEXT_PUBLIC_VPN_AFFILIATE_URL),
  vpnName: process.env.NEXT_PUBLIC_VPN_NAME?.trim().slice(0, 40) || 'a trusted VPN',
};

/** Pages linked from the footer and listed in the sitemap (the trust pages AdSense reviewers look for). */
export const FOOTER_PAGES = [
  { href: '/app', label: 'Get the app' },
  { href: '/watch-on-tv', label: 'Watch on TV' },
  { href: '/about', label: 'About' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/contact', label: 'Contact' },
  { href: '/dmca', label: 'Copyright / DMCA' },
] as const;
