import type { MetadataRoute } from 'next';
import { api } from '@/lib/api-client';

export const revalidate = 3600;

const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const MAX_CHANNEL_PAGES = 100; // 100 × 100 = 10k channels, well under the 50k sitemap limit

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${site}/`, changeFrequency: 'hourly', priority: 1 },
    { url: `${site}/browse`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${site}/categories`, changeFrequency: 'daily', priority: 0.6 },
  ];
  try {
    const [countries, categories, languages] = await Promise.all([
      api.countries(),
      api.categories(),
      api.languages(),
    ]);
    entries.push(
      ...countries.map((c) => ({
        url: `${site}/country/${c.id.toLowerCase()}`,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
      ...categories.map((c) => ({
        url: `${site}/category/${c.id}`,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
      ...languages.map((l) => ({
        url: `${site}/language/${l.id}`,
        changeFrequency: 'daily' as const,
        priority: 0.6,
      })),
    );
    let cursor: string | undefined;
    for (let i = 0; i < MAX_CHANNEL_PAGES; i++) {
      const page = await api.channels({ limit: 100, cursor });
      entries.push(
        ...page.items.map((c) => ({
          url: `${site}/watch/${encodeURIComponent(c.id)}`,
          changeFrequency: 'daily' as const,
          priority: 0.5,
        })),
      );
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
  } catch {
    // API unreachable: serve the static entries rather than failing the sitemap.
  }
  return entries;
}
