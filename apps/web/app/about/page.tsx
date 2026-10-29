import type { Metadata } from 'next';
import Link from 'next/link';
import { ProsePage } from '@/components/layout/prose-page';
import { CONTACT_EMAIL, SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About',
  description: `${SITE_NAME} is a free directory of publicly available live TV channels from around the world.`,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <ProsePage title={`About ${SITE_NAME}`}>
      <p>
        {SITE_NAME} is a free directory of live TV channels that broadcasters make publicly available on the
        internet. Pick a channel and it plays right in your browser, on a phone, computer or TV, with no app,
        no account and no VLC.
      </p>
      <h2>Where the channels come from</h2>
      <p>
        The channel list comes from{' '}
        <a href="https://github.com/iptv-org/iptv" rel="noopener">
          iptv-org
        </a>
        , an open-source project that collects publicly available stream links. We sync it every day, check
        every stream several times a day, and show you which channels are live right now.
      </p>
      <h2>We only link, we never host</h2>
      <p>
        {SITE_NAME} does not host, record, re-stream or store any video. The player connects your browser
        directly to the broadcaster&apos;s own public stream. If you own the rights to a channel and want it
        removed, see our <Link href="/dmca">copyright page</Link>: we take channels down quickly.
      </p>
      <h2>How we pay for it</h2>
      <p>
        {SITE_NAME} is free and shows a few display ads, never on or over the video. See our{' '}
        <Link href="/privacy">privacy policy</Link> for how ads use cookies.
      </p>
      <h2>Contact</h2>
      <p>
        Questions, feedback or a channel that doesn&apos;t work? Email{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </ProsePage>
  );
}
