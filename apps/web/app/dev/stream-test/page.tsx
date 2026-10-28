import { notFound } from 'next/navigation';
import { StreamTest } from './stream-test';

export const dynamic = 'force-dynamic';

export default async function StreamTestPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const res = await fetch(`${api}/v1/dev/web-playable-sample?n=50`, { cache: 'no-store' });
  const { items } = (await res.json()) as {
    items: { stream_id: string; name: string; url: string; score: number }[];
  };
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-bold">Stream test</h1>
      <p className="text-text-muted mt-1 text-sm">
        Plays {items.length} random web-playable streams one after another (muted). Development only.
      </p>
      <StreamTest items={items} />
    </main>
  );
}
