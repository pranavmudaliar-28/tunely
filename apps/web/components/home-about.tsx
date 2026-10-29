import Link from 'next/link';
import { JsonLd } from '@/components/json-ld';
import { SITE_NAME, SITE_URL } from '@/lib/site';

const FAQ = [
  {
    q: `Is ${SITE_NAME} free?`,
    a: `Yes. Every channel on ${SITE_NAME} is free to watch, with no account or subscription. A few display ads, never on the video, keep the site running.`,
  },
  {
    q: 'Which devices does it work on?',
    a: 'Any modern browser: Android and iPhone, Windows and Mac computers, tablets and smart TVs with a browser. Nothing to install.',
  },
  {
    q: "Why won't a channel play?",
    a: 'Broadcasters sometimes go offline, limit their stream to some countries, or use video your device cannot decode. We check every stream several times a day and show which channels are live now; try the next channel or come back later.',
  },
  {
    q: `Does ${SITE_NAME} host the channels?`,
    a: `No. ${SITE_NAME} only links to streams that broadcasters make publicly available; your browser plays them directly from the broadcaster. Rights holders can ask us to remove a channel at any time.`,
  },
];

/** Text section for the home page: what the site is, plus an FAQ (also as FAQPage structured data). */
export function HomeAbout() {
  return (
    <section aria-labelledby="about-tunely" className="flex max-w-[760px] flex-col gap-4 pr-4 sm:pr-14">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE_NAME,
          url: SITE_URL,
          potentialAction: {
            '@type': 'SearchAction',
            target: `${SITE_URL}/browse?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQ.map(({ q, a }) => ({
            '@type': 'Question',
            name: q,
            acceptedAnswer: { '@type': 'Answer', text: a },
          })),
        }}
      />
      <h2 id="about-tunely" className="text-xl font-bold">
        Free live TV from around the world
      </h2>
      <p className="text-text-soft text-[15px] leading-relaxed">
        {SITE_NAME} brings together thousands of free, publicly available TV channels from over 200 countries:
        news, sports, movies, music, kids and more, in dozens of languages. Pick a channel and it plays
        straight away in your browser. Browse by <Link href="/categories">category</Link>, search in{' '}
        <Link href="/browse">Live TV</Link>, or save channels to your favorites.
      </p>
      <h2 className="pt-2 text-xl font-bold">Frequently asked questions</h2>
      <div className="flex flex-col gap-2">
        {FAQ.map(({ q, a }) => (
          <details key={q} className="border-border bg-surface rounded-[8px] border px-4 py-3">
            <summary className="cursor-pointer font-semibold">{q}</summary>
            <p className="text-text-soft pt-2 text-[15px] leading-relaxed">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
