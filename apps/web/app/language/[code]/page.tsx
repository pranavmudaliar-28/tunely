import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrowsePage } from '@/components/channel/browse-page';
import { api } from '@/lib/api-client';
import { nativeLanguageName } from '@/lib/format';

// Channel statuses change as streams are checked: refresh every 5 minutes.
export const revalidate = 300;
export const generateStaticParams = async () => [];

type Props = { params: Promise<{ code: string }> };

async function language(params: Props['params']) {
  const code = (await params).code.toLowerCase();
  if (!/^[a-z]{2,3}$/.test(code)) notFound();
  const facet = (await api.languages().catch(() => [])).find((l) => l.id === code);
  return { code, name: facet?.name ?? code };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code, name } = await language(params);
  return {
    title: `Live TV in ${name}: watch free online`,
    description: `Watch free ${name} TV channels live in your browser on phone, computer or TV. No app, no sign-up.`,
    alternates: { canonical: `/language/${code}` },
  };
}

export default async function LanguagePage({ params }: Props) {
  const { code, name } = await language(params);
  const native = nativeLanguageName(code, name);
  return (
    <BrowsePage
      title={native === name ? `Live TV in ${name}` : `Live TV in ${name} · ${native}`}
      subject={`in ${name}`}
      filters={{ language: code }}
    />
  );
}
