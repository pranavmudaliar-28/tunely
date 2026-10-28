import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrowsePage } from '@/components/channel/browse-page';
import { countryName } from '@/lib/format';

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
  return {
    title: `Live TV from ${name}`,
    description: `Watch free live TV channels from ${name} in your browser. No app, no sign-up.`,
    alternates: { canonical: `/country/${code.toLowerCase()}` },
  };
}

export default async function CountryPage({ params }: Props) {
  const code = await parse(params);
  return <BrowsePage title={`Live TV from ${countryName(code)}`} filters={{ country: code }} />;
}
