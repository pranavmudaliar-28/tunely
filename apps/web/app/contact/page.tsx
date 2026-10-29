import type { Metadata } from 'next';
import Link from 'next/link';
import { ProsePage } from '@/components/layout/prose-page';
import { CONTACT_EMAIL, SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Get in touch with the ${SITE_NAME} team.`,
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <ProsePage title="Contact us">
      <p>
        Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We usually reply within two working
        days.
      </p>
      <h2>Helpful details to include</h2>
      <ul>
        <li>A channel that doesn&apos;t play: the channel page link, your device and browser.</li>
        <li>A channel you&apos;d like added: its name, country and official website.</li>
        <li>
          Rights holders asking for removal: please follow the steps on our{' '}
          <Link href="/dmca">copyright page</Link> so we can act quickly.
        </li>
      </ul>
      <p>{SITE_NAME} is run independently by a small team.</p>
    </ProsePage>
  );
}
