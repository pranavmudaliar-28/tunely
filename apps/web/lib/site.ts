export const SITE_NAME = 'Tunely';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
export const CONTACT_EMAIL = 'pranavmudaliar36@gmail.com';

/** The trust pages AdSense reviewers look for; linked from the footer and listed in the sitemap. */
export const LEGAL_PAGES = [
  { href: '/about', label: 'About' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/contact', label: 'Contact' },
  { href: '/dmca', label: 'Copyright / DMCA' },
] as const;
