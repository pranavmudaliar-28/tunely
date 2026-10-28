import type { Metadata } from 'next';
import { Inter, Noto_Sans } from 'next/font/google';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const noto = Noto_Sans({ subsets: ['latin', 'devanagari'], variable: '--font-noto', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Tunely: free live TV in your browser', template: '%s · Tunely' },
  description: 'Watch free, publicly available live TV channels instantly. No app, no sign-up.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${inter.variable} ${noto.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
