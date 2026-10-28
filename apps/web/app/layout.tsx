import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { ADSENSE_CLIENT } from '@/lib/ads';
import {
  Inter,
  Noto_Sans,
  Noto_Sans_Bengali,
  Noto_Sans_Gujarati,
  Noto_Sans_Gurmukhi,
  Noto_Sans_Tamil,
} from 'next/font/google';
import { AppShell } from '@/components/layout/app-shell';
import { themeScript } from '@/components/layout/theme-toggle';
import { Providers } from '@/components/providers';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
// Indian scripts load only when a page actually uses those glyphs (unicode-range), so no preload.
const noto = Noto_Sans({ subsets: ['devanagari'], variable: '--font-noto', display: 'swap', preload: false });
const gujarati = Noto_Sans_Gujarati({
  subsets: ['gujarati'],
  variable: '--font-gujarati',
  display: 'swap',
  preload: false,
});
const tamil = Noto_Sans_Tamil({
  subsets: ['tamil'],
  variable: '--font-tamil',
  display: 'swap',
  preload: false,
});
const bengali = Noto_Sans_Bengali({
  subsets: ['bengali'],
  variable: '--font-bengali',
  display: 'swap',
  preload: false,
});
const gurmukhi = Noto_Sans_Gurmukhi({
  subsets: ['gurmukhi'],
  variable: '--font-gurmukhi',
  display: 'swap',
  preload: false,
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Tunely: free live TV in your browser', template: '%s · Tunely' },
  description: 'Watch free, publicly available live TV channels instantly. No app, no sign-up.',
  applicationName: 'Tunely',
  openGraph: { siteName: 'Tunely', type: 'website' },
  // AdSense site verification.
  other: ADSENSE_CLIENT ? { 'google-adsense-account': ADSENSE_CLIENT } : undefined,
};

export const viewport: Viewport = { themeColor: '#0B0D12', colorScheme: 'dark light' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fonts = [inter, noto, gujarati, tamil, bengali, gurmukhi].map((f) => f.variable).join(' ');
  return (
    <html lang="en" data-theme="dark" className={fonts} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
        {ADSENSE_CLIENT && (
          <Script
            id="adsense"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
        )}
      </body>
    </html>
  );
}
