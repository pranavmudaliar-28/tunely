import type { Metadata } from 'next';
import Link from 'next/link';
import { ProsePage } from '@/components/layout/prose-page';
import { CONTACT_EMAIL, SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: `The terms for using ${SITE_NAME}.`,
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <ProsePage title="Terms of use" updated="29 October 2026">
      <p>By using {SITE_NAME} you agree to these terms.</p>
      <h2>The service</h2>
      <ul>
        <li>
          {SITE_NAME} is a free directory of links to live TV streams that broadcasters make publicly
          available. We do not host, record or re-stream any video.
        </li>
        <li>
          Channels, their streams and their content belong to their broadcasters. We don&apos;t control what
          they show and can&apos;t promise any channel will be available, in your region or at all.
        </li>
        <li>The service is provided &quot;as is&quot;, without warranties of any kind.</li>
      </ul>
      <h2>Your use</h2>
      <ul>
        <li>Use {SITE_NAME} for personal, non-commercial viewing, and follow the laws of your country.</li>
        <li>Don&apos;t scrape, overload or try to break the site or its API.</li>
      </ul>
      <h2>Copyright</h2>
      <p>
        If you own the rights to a channel listed here, see our <Link href="/dmca">copyright page</Link> to
        have it removed.
      </p>
      <h2>Changes and contact</h2>
      <p>
        We may update these terms; the date above shows the latest version. Questions:{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </ProsePage>
  );
}
