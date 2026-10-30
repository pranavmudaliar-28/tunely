import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/json-ld';
import { InstallButton } from '@/components/layout/install-button';
import { ProsePage } from '@/components/layout/prose-page';
import { breadcrumbs } from '@/lib/seo';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Free Live TV App for Android, iPhone & PC',
  description: `Install ${SITE_NAME} as an app in two taps, straight from your browser: no Play Store, no APK, free. Works on Android, iPhone, iPad, Windows and Mac.`,
  alternates: { canonical: '/app' },
};

// Only claims that are true for a web app: no APK, no store listing, no offline playback.
const FAQ = [
  {
    q: 'Is the app free?',
    a: `Yes. ${SITE_NAME} is free to install and use, with no account or subscription.`,
  },
  {
    q: 'Do I need to download an APK or use the Play Store?',
    a: `No. ${SITE_NAME} is a web app: your browser installs it directly, and it updates itself every time you open it.`,
  },
  {
    q: 'Does it work offline?',
    a: 'No. Live TV streams over the internet, so you need a connection to watch.',
  },
  {
    q: 'What does the app store on my phone?',
    a: 'Only your favorites, recently watched channels and settings, on your device. No account, no personal data.',
  },
];

export default function AppPage() {
  return (
    <ProsePage title="Get the free live TV app">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: SITE_NAME,
          url: SITE_URL,
          applicationCategory: 'EntertainmentApplication',
          operatingSystem: 'Android, iOS, iPadOS, Windows, macOS, ChromeOS',
          browserRequirements: 'Requires a modern browser such as Chrome, Edge or Safari',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
        }}
      />
      <JsonLd
        data={breadcrumbs([
          { name: 'Home', path: '/' },
          { name: 'Get the app', path: '/app' },
        ])}
      />
      <p>
        Put {SITE_NAME} on your home screen and open live TV in one tap, full screen like any other app. It
        installs straight from your browser in a few seconds: no Play Store, no APK, no account.
      </p>
      <InstallButton variant="cta" />
      <p className="text-text-muted text-[13px]">
        No button above? Your browser installs from its menu instead; the steps for each device are below.
      </p>

      <h2>Android phones and tablets</h2>
      <ul>
        <li>Open {SITE_NAME} in Chrome.</li>
        <li>
          Tap <strong>Install</strong> (top of the screen or on this page), or open the <strong>⋮</strong>{' '}
          menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
        </li>
      </ul>

      <h2>iPhone and iPad</h2>
      <ul>
        <li>Open {SITE_NAME} in Safari.</li>
        <li>
          Tap the <strong>Share</strong> button, then <strong>Add to Home Screen</strong>.
        </li>
      </ul>

      <h2>Windows, Mac and Chromebook</h2>
      <ul>
        <li>Open {SITE_NAME} in Chrome or Microsoft Edge.</li>
        <li>
          Click the install icon at the right end of the address bar, or open the browser menu and choose{' '}
          <strong>Install {SITE_NAME}</strong>. It opens in its own window.
        </li>
      </ul>

      <h2>Android TV, Google TV and Fire TV</h2>
      <p>
        TVs can&apos;t install web apps, but {SITE_NAME} works in a TV browser or by casting from your phone.
        See <Link href="/watch-on-tv">how to watch on your TV</Link>.
      </p>

      <h2>Questions</h2>
      {FAQ.map(({ q, a }) => (
        <div key={q}>
          <h3 className="text-text pt-2 text-base font-semibold">{q}</h3>
          <p>{a}</p>
        </div>
      ))}
      <p>
        Ready to watch? <Link href="/browse?status=live">See the channels that are live right now</Link>.
      </p>
    </ProsePage>
  );
}
