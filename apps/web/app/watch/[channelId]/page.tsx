import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ChannelRail } from '@/components/channel/channel-rail';
import { StatusDot } from '@/components/channel/channel-logo';
import { FavoriteButton } from '@/components/channel/favorite-button';
import { ShareButton } from '@/components/channel/share-button';
import { Player } from '@/components/player/player';
import { api, ApiError } from '@/lib/api-client';
import { channelMeta, countryName } from '@/lib/format';

export const revalidate = 300;

const STATUS_TEXT = {
  live: 'Online',
  offline: 'Offline',
  no_stream: 'No stream available',
  closed: 'Closed',
} as const;
export const generateStaticParams = async () => [];

type Props = { params: Promise<{ channelId: string }> };

async function getChannel(id: string) {
  try {
    return await api.channel(decodeURIComponent(id));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getChannel((await params).channelId);
  const title = `Watch ${c.name} live`;
  const description = `${c.name} live from ${countryName(c.country)}. Free to watch in your browser, no sign-up.`;
  return {
    title,
    description,
    alternates: { canonical: `/watch/${encodeURIComponent(c.id)}` },
    openGraph: { title, description, images: c.logo ? [{ url: c.logo }] : undefined },
    // Keep channels that can't play out of search results.
    robots: c.status === 'live' ? undefined : { index: false },
  };
}

export default async function WatchPage({ params }: Props) {
  const channel = await getChannel((await params).channelId);
  const [related, languages] = await Promise.all([
    api.related(channel.id).catch(() => ({ items: [], nextCursor: null })),
    api.languages().catch(() => []),
  ]);
  const languageNames = Object.fromEntries(languages.map((l) => [l.id, l.name]));
  const meta = channelMeta(channel, languageNames);
  const best = channel.streams.find((s) => s.webPlayable);
  const sameCountry = related.items.filter((c) => c.country === channel.country);
  const sameCategory = related.items.filter((c) => c.country !== channel.country);

  return (
    <>
      <Player channel={channel} fallbackLineup={related.items} meta={meta} />

      <section className="flex flex-wrap items-start justify-between gap-x-10 gap-y-5 px-4 pt-7 pb-2 sm:px-14">
        <div className="flex grow basis-[420px] flex-col gap-2.5">
          <h1 className="text-[32px] font-extrabold tracking-[-0.02em]">{channel.name}</h1>
          <p className="text-text-muted flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
            <span>{meta}</span>
            {best ? (
              <StatusDot
                status={best.score >= 80 ? 'online' : 'unstable'}
                label={best.score >= 80 ? 'Online' : 'Unstable'}
              />
            ) : (
              <StatusDot status="offline" label={STATUS_TEXT[channel.status]} />
            )}
          </p>
          {channel.website && (
            <p className="text-text-soft text-[15px]">
              <a
                href={channel.website}
                rel="noopener nofollow"
                target="_blank"
                className="text-text underline underline-offset-2"
              >
                Official website
              </a>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2.5">
          <FavoriteButton channel={channel} />
          <ShareButton title={channel.name} />
        </div>
      </section>

      <div className="flex flex-col gap-10 pt-7 pb-14 pl-4 sm:pl-14">
        <ChannelRail
          title={`More from ${countryName(channel.country)}`}
          items={sameCountry}
          languageNames={languageNames}
        />
        <ChannelRail title="Similar channels" items={sameCategory} languageNames={languageNames} />
      </div>
    </>
  );
}
