import type { Metadata } from 'next';
import Link from 'next/link';
import { ProsePage } from '@/components/layout/prose-page';
import { AFFILIATE, SITE_NAME, SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Watch free live TV on your TV',
  description: `How to watch ${SITE_NAME}'s free live channels on a smart TV, Fire TV Stick, Android TV or Chromecast.`,
  alternates: { canonical: '/watch-on-tv' },
};

const DEVICES = [
  { name: 'Fire TV Stick', search: 'fire tv stick' },
  { name: 'Chromecast with Google TV', search: 'chromecast google tv' },
  { name: 'Android TV box', search: 'android tv box' },
];

const amazonLink = (search: string) =>
  `https://www.${AFFILIATE.amazonDomain}/s?k=${encodeURIComponent(search)}&tag=${AFFILIATE.amazonTag}`;

export default function WatchOnTvPage() {
  const hasAffiliate = Boolean(AFFILIATE.amazonTag || AFFILIATE.vpnUrl);
  return (
    <ProsePage title="Watch on your TV">
      <p>
        {SITE_NAME} works in any modern web browser, so the big screen is only a few steps away. Pick the way
        that matches your setup.
      </p>

      <h2>Smart TV with a browser</h2>
      <ul>
        <li>Open the TV&apos;s web browser (on Samsung, LG and most Android TVs it&apos;s built in).</li>
        <li>
          Go to <strong>{new URL(SITE_URL).host}</strong> and pick a channel. Use the remote&apos;s arrow
          keys: up and down switch channels, OK plays.
        </li>
      </ul>

      <h2>Cast from your phone or laptop</h2>
      <ul>
        <li>
          In Chrome on a computer, open a channel, then menu → <strong>Cast…</strong> → choose your TV.
        </li>
        <li>
          On Android, use <strong>Screen cast</strong> from the quick settings. On iPhone, use{' '}
          <strong>Screen Mirroring</strong> with an AirPlay TV.
        </li>
      </ul>

      <h2>Fire TV Stick, Android TV or Google TV</h2>
      <ul>
        <li>
          Install a browser (Silk or Firefox on Fire TV, Chrome or TV Bro on Android TV) and open {SITE_NAME}.
        </li>
        <li>Add it as a bookmark so it&apos;s one click away next time.</li>
      </ul>

      {AFFILIATE.amazonTag && (
        <>
          <h2>No smart TV? These turn any TV with HDMI into one</h2>
          <ul>
            {DEVICES.map((d) => (
              <li key={d.name}>
                <a href={amazonLink(d.search)} target="_blank" rel="sponsored noopener">
                  {d.name} on Amazon
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      {AFFILIATE.vpnUrl && (
        <>
          <h2>Stay private on public Wi-Fi</h2>
          <p>
            Watching at a hotel, airport or café? Public networks can be monitored. A VPN encrypts your
            connection; we suggest{' '}
            <a href={AFFILIATE.vpnUrl} target="_blank" rel="sponsored noopener">
              {AFFILIATE.vpnName}
            </a>
            . Please respect broadcasters&apos; terms in your country.
          </p>
        </>
      )}

      <h2>Channel won&apos;t play on the TV?</h2>
      <p>
        Some older TV browsers can&apos;t play live streams. Casting from a phone or laptop almost always
        works. You can also <Link href="/browse?status=live">browse channels that are live right now</Link>.
      </p>

      {hasAffiliate && (
        <p className="text-text-muted text-[13px]">
          Some links on this page are affiliate links: if you buy through them, {SITE_NAME} may earn a small
          commission at no extra cost to you.
          {AFFILIATE.amazonTag && ' As an Amazon Associate we earn from qualifying purchases.'}
        </p>
      )}
    </ProsePage>
  );
}
