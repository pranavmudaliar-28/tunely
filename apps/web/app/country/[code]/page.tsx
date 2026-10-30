import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrowsePage } from '@/components/channel/browse-page';
import { api } from '@/lib/api-client';
import { countryName } from '@/lib/format';
import { facetRobots } from '@/lib/seo';

// Channel statuses change as streams are checked: refresh every 5 minutes.
export const revalidate = 300;
export const generateStaticParams = async () => [];

type Props = { params: Promise<{ code: string }> };
const parse = async (params: Props['params']) => {
  const code = (await params).code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) notFound();
  return code;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = await parse(params);
  const name = countryName(code);
  const live = await api.facets({ status: 'live' }).catch(() => null);
  return {
    robots: facetRobots(live?.countries, code),
    title: `Live TV channels from ${name}: watch free online`,
    description: `Watch free live TV channels from ${name} in your browser on phone, computer or TV. News, entertainment, sports and more. No app, no sign-up.`,
    alternates: { canonical: `/country/${code.toLowerCase()}` },
  };
}

export default async function CountryPage({ params }: Props) {
  const code = await parse(params);
  const name = countryName(code);
  return <BrowsePage title={`Live TV from ${name}`} subject={`from ${name}`} filters={{ country: code }} />;
}
