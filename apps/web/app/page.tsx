import type { ChannelSummary, Facet } from '@tunely/shared';
import Link from 'next/link';
import { ChannelRail, Scroller } from '@/components/channel/channel-rail';
import { ContinueWatching } from '@/components/channel/continue-watching';
import { ChannelLogo, LiveBadge } from '@/components/channel/channel-logo';
import { FavoriteButton } from '@/components/channel/favorite-button';
import { HeroWall } from '@/components/channel/hero-wall';
import { PlayIcon } from '@/components/ui/icons';
import { api } from '@/lib/api-client';
import { channelMeta, countryName, nativeLanguageName, tint } from '@/lib/format';

export const revalidate = 300;

// India is the launch market; per-viewer country comes with user settings (Phase 5).
const HOME_COUNTRY = 'IN';

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
  const topCategories = categories.filter((c) => c.id !== 'news' && c.count >= 4).slice(0, 4);
  const categoryRails = await Promise.all(
    topCategories.map(async (c) => ({
      facet: c,
      items: (
        await settle(api.channels({ category: c.id, status: 'live', limit: 12 }), {
          items: [],
          nextCursor: null,
        })
      ).items,
    })),
  );
  return { trending, local: local.items, worldNews: worldNews.items, categoryRails, languages };
}

export default async function HomePage() {
  const { trending, local, worldNews, categoryRails, languages } = await load();
  const languageNames = Object.fromEntries(languages.map((l) => [l.id, l.name]));
  const featured: ChannelSummary | undefined = trending[0] ?? local[0] ?? worldNews[0];
  const popularLocal = trending.filter((c) => c.country === HOME_COUNTRY);
  const meta = (c: ChannelSummary) => channelMeta(c, languageNames);
  const wallItems = [...trending, ...local, ...worldNews].slice(0, 20);

  if (!featured) {
    return (
      <div className="flex flex-col items-center gap-3 p-16 text-center">
        <h1 className="text-3xl font-extrabold">Tunely</h1>
        <p className="text-text-muted">
          No channels are available right now. Please check back in a few minutes.
        </p>
      </div>
    );
  }

  return (
    <>
      <section aria-label="Featured channel" className="relative h-[500px] overflow-hidden sm:h-[560px]">
        <HeroWall items={wallItems} />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,var(--bg)_28%,color-mix(in_srgb,var(--bg)_80%,transparent)_50%,transparent_80%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(0deg,var(--bg)_0%,transparent_35%)]"
        />
        {featured.logo && (
          <div
            aria-hidden="true"
            className="absolute top-1/2 right-[8%] hidden w-[min(34vw,460px)] -translate-y-1/2 rotate-[-6deg] lg:block"
          >
            <ChannelLogo
              id={featured.id}
              name={featured.name}
              logo={featured.logo}
              eager
              className="border-text/15 rounded-[16px] border shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8),0_0_80px_-10px_color-mix(in_srgb,var(--accent)_45%,transparent)]"
            >
              <LiveBadge className="top-4 left-4" />
            </ChannelLogo>
          </div>
        )}
        <div className="relative flex h-full max-w-[680px] flex-col justify-end gap-[18px] px-4 pb-10 sm:px-14 sm:pb-14">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="bg-live flex items-center gap-1.5 rounded-[6px] px-2.5 py-[5px] text-xs font-extrabold tracking-[0.08em] text-[#0B0D12]">
              <span aria-hidden="true" className="size-[7px] rounded-full bg-[#0B0D12]" />
              LIVE
            </span>
            <span className="text-text-muted text-[13px] font-semibold tracking-[0.08em] uppercase">
              {trending[0] ? 'Most watched now' : 'Featured channel'}
            </span>
          </div>
          <h1 className="text-5xl leading-none font-extrabold tracking-[-0.03em] sm:text-[72px]">
            {featured.name}
          </h1>
          <p className="text-text-soft flex flex-wrap gap-x-3.5 gap-y-1.5 text-[15px] font-medium">
            {meta(featured)}
            {featured.quality && (
              <span className="border-text-muted rounded border px-1.5 text-xs font-bold leading-5">
                {featured.quality}
              </span>
            )}
          </p>
          <p className="text-text-soft max-w-[520px] text-lg leading-normal">
            Live now. Free to watch, no sign-up needed.
          </p>
          <div className="flex flex-wrap gap-3 pt-1.5">
            <Link
              href={`/watch/${encodeURIComponent(featured.id)}`}
              className="bg-text text-bg flex h-[52px] items-center gap-2.5 rounded-[8px] px-7 text-[17px] font-bold no-underline"
            >
              <PlayIcon size={20} />
              Watch live
            </Link>
            <FavoriteButton channel={featured} secondary className="h-[52px] px-6 text-[17px]" />
          </div>
        </div>
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
        {categoryRails.map(({ facet, items }) => (
          <ChannelRail
            key={facet.id}
            title={facet.name}
            items={items}
            seeAllHref={`/category/${facet.id}`}
            languageNames={languageNames}
          />
        ))}
      </div>
    </>
  );
}
