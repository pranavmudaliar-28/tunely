import type { Metadata } from 'next';
import { ProsePage } from '@/components/layout/prose-page';
import { CONTACT_EMAIL, SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: `How ${SITE_NAME} handles your data, cookies and ads.`,
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy policy" updated="29 October 2026">
      <p>
        {SITE_NAME} works without an account. This page explains what little data the site uses, and how the
        ads on it use cookies.
      </p>

      <h2>What stays on your device</h2>
      <ul>
        <li>Your favorites, recently watched channels, volume and theme are saved in your browser only.</li>
        <li>We never see them, and clearing your browser data removes them.</li>
      </ul>

      <h2>What we collect</h2>
      <ul>
        <li>
          When a channel starts or fails to play, your browser sends an anonymous playback report: which
          stream, whether it played, the error type and how long it took. We use it to show which channels
          work.
        </li>
        <li>
          We do not store IP addresses. To count distinct viewers we keep a hash of a random session id,
          salted with a secret that changes every day, so reports cannot be linked to you or across days.
        </li>
        <li>Our hosting providers keep standard server logs for security, for a short time.</li>
      </ul>

      <h2>Advertising and cookies</h2>
      <ul>
        <li>
          {SITE_NAME} shows ads served by Google AdSense. Third-party vendors, including Google, use cookies
          to serve ads based on your prior visits to this website or other websites.
        </li>
        <li>
          Google&apos;s use of advertising cookies enables it and its partners to serve ads to you based on
          your visit to this site and/or other sites on the internet.
        </li>
        <li>
          You can opt out of personalised advertising in{' '}
          <a href="https://adssettings.google.com" rel="noopener">
            Google Ads Settings
          </a>
          , or opt out of some third-party vendors&apos; cookies at{' '}
          <a href="https://www.aboutads.info/choices/" rel="noopener">
            aboutads.info
          </a>
          .
        </li>
        <li>
          Learn more in{' '}
          <a href="https://policies.google.com/technologies/partner-sites" rel="noopener">
            How Google uses information from sites that use its services
          </a>
          .
        </li>
        <li>
          Visitors in the European Economic Area, the UK and Switzerland are asked for consent through
          Google&apos;s consent message before personalised ads are shown.
        </li>
      </ul>

      <h2>Video streams</h2>
      <p>
        When you play a channel, your browser connects directly to the broadcaster&apos;s server, which sees
        your IP address as with any website. Their privacy policies apply to that connection.
      </p>

      <h2>Children</h2>
      <p>
        {SITE_NAME} is not directed at children under 13 and does not knowingly collect their personal data.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We update this page when our practices change. Questions:{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </ProsePage>
  );
}
