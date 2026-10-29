import type { Metadata } from 'next';
import { ProsePage } from '@/components/layout/prose-page';
import { CONTACT_EMAIL, SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Copyright and takedown (DMCA)',
  description: `How rights holders can have a channel removed from ${SITE_NAME}.`,
  alternates: { canonical: '/dmca' },
};

export default function DmcaPage() {
  return (
    <ProsePage title="Copyright and takedown" updated="29 October 2026">
      <p>
        {SITE_NAME} does not host any video. Channel pages link to streams that broadcasters publish on the
        open internet, listed by the open-source iptv-org project. We respect copyright and remove channels
        when the rights holder asks.
      </p>
      <h2>How to request removal</h2>
      <p>
        Email <a href={`mailto:${CONTACT_EMAIL}?subject=Takedown%20request`}>{CONTACT_EMAIL}</a> with the
        subject &quot;Takedown request&quot; and include:
      </p>
      <ul>
        <li>the link to each channel page on {SITE_NAME} you want removed;</li>
        <li>the work you own and proof that you own it or act for the owner;</li>
        <li>your name, organisation and contact details;</li>
        <li>
          a statement that you believe in good faith the use is not authorised, and that your notice is
          accurate.
        </li>
      </ul>
      <h2>What happens next</h2>
      <p>
        We review every request and take valid ones down, usually within 2 working days. A removed channel
        disappears from the site, search results and our sitemap. You may also want to ask the{' '}
        <a href="https://github.com/iptv-org/iptv" rel="noopener">
          iptv-org project
        </a>{' '}
        to remove the stream link at the source.
      </p>
    </ProsePage>
  );
}
