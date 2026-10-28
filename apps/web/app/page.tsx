import type { ChannelSummary, Facet } from '@tunely/shared';
import Link from 'next/link';
import { Fragment } from 'react';
import { AdBanner } from '@/components/ads/ad-banner';
import { ChannelRail, Scroller } from '@/components/channel/channel-rail';
import { ContinueWatching } from '@/components/channel/continue-watching';
import { HeroCarousel, type HeroSlide } from '@/components/channel/hero-carousel';
import { HeroWall } from '@/components/channel/hero-wall';
import { api } from '@/lib/api-client';
import { channelMeta, countryName, nativeLanguageName, tint } from '@/lib/format';

export const revalidate = 300;

// India is the launch market; per-viewer country comes with user settings (Phase 5).
const HOME_COUNTRY = 'IN';
const HERO_CATEGORIES = [
  'news',
  'entertainment',
  'movies',
  'sports',
  'music',
  'kids',
  'documentary',
  'religious',
];
const MAX_SLIDES = 7;
/** One banner before the first category rail, then one every this many rails. */
const AD_EVERY_RAILS = 6;
const RAIL_PRIORITY = [
  'entertainment',
  'movies',
  'sports',
  'kids',
  'music',
  'news',
  'series',
  'documentary',
  'comedy',
  'animation',
  'religious',
  'general',
];
const RAIL_LAST = ['shop'];
/** Categories with fewer live channels than this get no rail (still reachable from Categories). */
const MIN_RAIL_ITEMS = 6;

async function load() {
  const settle = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
  const [trending, local, worldNews, categories, languages] = await Promise.all([
    settle(api.trending(), []),
    settle(api.channels({ country: HOME_COUNTRY, status: 'live', limit: 12 }), {
      items: [],
      nextCursor: null,
    }),
    settle(api.channels({ category: 'news', language: 'eng', status: 'live', limit: 12 }), {
      items: [],
      nextCursor: null,
    }),
    settle(api.categories(), [] as Facet[]),
    settle(api.languages(), [] as Facet[]),
  ]);
  // A rail for every category: popular ones first, then the rest by size, shopping last.
  // Each rail shows its best live channels (health score, then resolution).
  const rank = (id: string) => {
    const i = RAIL_PRIORITY.indexOf(id);
    return i === -1 ? (RAIL_LAST.includes(id) ? 1000 : 100) : i;
  };
  const railCategories = [...categories].sort((a, b) => rank(a.id) - rank(b.id) || b.count - a.count);
  const categoryRails = (
    await Promise.all(
      railCategories.map(async (c) => ({
        facet: c,
        items: (
          await settle(api.channels({ category: c.id, status: 'live', sort: 'best', limit: 12 }), {
            items: [],
            nextCursor: null,
          })
        ).items,
      })),
    )
  ).filter((r) => r.items.length >= MIN_RAIL_ITEMS);
  // Hero picks: the best-scoring live channels of the categories viewers care most about.
  const heroCategories = HERO_CATEGORIES.map((id) => categories.find((c) => c.id === id)).filter(
    (c): c is Facet => Boolean(c),
  );
  const heroPicks = await Promise.all(
    heroCategories.map(async (facet) => ({
      facet,
      items: (
        await settle(api.channels({ category: facet.id, status: 'live', sort: 'best', limit: 6 }), {
          items: [],
          nextCursor: null,
        })
      ).items,
    })),
  );
  return { trending, local: local.items, worldNews: worldNews.items, categoryRails, languages, heroPicks };
}

export default async function HomePage() {
  const { trending, local, worldNews, categoryRails, languages, heroPicks } = await load();
  const languageNames = Object.fromEntries(languages.map((l) => [l.id, l.name]));
  // One slide per category: its best live channel (score, then resolution), most watched first.
  const seen = new Set<string>();
  const slides: HeroSlide[] = [];
  const addSlide = (channel: ChannelSummary | undefined, label: string) => {
    if (!channel || seen.has(channel.id) || slides.length >= MAX_SLIDES) return;
    seen.add(channel.id);
    slides.push({ channel, label, meta: channelMeta(channel, languageNames) });
  };
  addSlide(trending[0], 'Most watched now');
  for (const { facet, items } of heroPicks)
    addSlide(
      items.find((c) => c.logo && !seen.has(c.id)),
      `Best in ${facet.name}`,
    );
  addSlide(local[0] ?? worldNews[0], 'Featured channel');
  const featured = slides[0]?.channel;
  const popularLocal = trending.filter((c) => c.country === HOME_COUNTRY);
  const wallItems = [...trending, ...local, ...worldNews].slice(0, 20);

  if (!featured) {
    return (
      <div className="flex flex-col items-center gap-3 p-16 text-center">
        <h1 className="text-3xl font-extrabold">Tunely</h1>
        <p className="text-text-muted max-w-md">
          We&apos;re checking which channels are playing right now. Live channels appear here within a few
          minutes; meanwhile you can browse the full directory.
        </p>
        <Link
          href="/browse"
          className="bg-text text-bg mt-3 flex h-12 items-center rounded-[8px] px-6 font-bold no-underline"
        >
          Browse all channels
        </Link>
      </div>
    );
  }

  return (
    <>
      <section aria-label="Featured channels" className="relative h-[520px] overflow-hidden sm:h-[580px]">
        <HeroWall items={wallItems} />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,var(--bg)_28%,color-mix(in_srgb,var(--bg)_80%,transparent)_50%,transparent_80%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(0deg,var(--bg)_0%,transparent_35%)]"
        />
        <HeroCarousel slides={slides} />
      </section>

      <div className="flex flex-col gap-10 pt-2 pb-12 pl-4 sm:pl-14">
        <ContinueWatching />
        <ChannelRail
          title={`Popular in ${countryName(HOME_COUNTRY)}`}
          items={popularLocal.length >= 4 ? popularLocal : local}
          seeAllHref={`/country/${HOME_COUNTRY.toLowerCase()}`}
          languageNames={languageNames}
          eager
        />
        {languages.length > 0 && (
          <section aria-labelledby="langs">
            <h2 id="langs" className="pb-3.5 text-xl font-bold">
              Watch in your language
            </h2>
            <Scroller label="Languages" list buttonTop={48}>
              {languages.slice(0, 10).map((l) => (
                <div role="listitem" key={l.id} className="shrink-0 snap-start">
                  <Link
                    href={`/language/${l.id}`}
                    className="text-text flex h-24 w-[168px] flex-col justify-between rounded-[10px] px-4 py-3.5 no-underline"
                    style={{ background: tint(l.id) }}
                  >
                    <span className="text-2xl font-bold">{nativeLanguageName(l.id, l.name)}</span>
                    <span className="text-text-soft text-[13px] font-medium">
                      {l.name} · {l.count}
                    </span>
                  </Link>
                </div>
              ))}
            </Scroller>
          </section>
        )}
        <ChannelRail
          title="World news in English"
          items={worldNews}
          seeAllHref="/browse?category=news&language=eng"
          languageNames={languageNames}
        />
        {categoryRails.map(({ facet, items }, i) => (
          <Fragment key={facet.id}>
            {i % AD_EVERY_RAILS === 0 && <AdBanner placement="home" className="mr-4 sm:mr-14" />}
            <ChannelRail
              title={facet.name}
              items={items}
              seeAllHref={`/category/${facet.id}`}
              languageNames={languageNames}
            />
          </Fragment>
        ))}
      </div>
    </>
  );
}
