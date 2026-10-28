import type { Facet } from '@tunely/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { nativeLanguageName, tint } from '@/lib/format';

export const revalidate = 1800;
export const metadata: Metadata = {
  title: 'Categories, countries and languages',
  alternates: { canonical: '/categories' },
};

function FacetGrid({
  title,
  items,
  href,
  label,
}: {
  title: string;
  items: Facet[];
  href(f: Facet): string;
  label?(f: Facet): string;
}) {
  if (!items.length) return null;
  return (
    <section aria-labelledby={`h-${title}`} className="flex flex-col gap-3.5">
      <h2 id={`h-${title}`} className="text-xl font-bold">
        {title}
      </h2>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3.5">
        {items.map((f) => (
          <li key={f.id}>
            <Link
              href={href(f)}
              className="text-text flex h-24 flex-col justify-between rounded-[10px] px-4 py-3.5 no-underline"
              style={{ background: tint(f.id) }}
            >
              <span className="text-xl font-bold">
                {f.flag ? <span aria-hidden="true">{f.flag} </span> : null}
                {label?.(f) ?? f.name}
              </span>
              <span className="text-text-soft text-[13px] font-medium">{f.count} channels</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function CategoriesPage() {
  const [categories, countries, languages] = await Promise.all([
    api.categories().catch(() => []),
    api.countries().catch(() => []),
    api.languages().catch(() => []),
  ]);
  return (
    <div className="flex flex-col gap-10 px-4 pt-8 pb-16 sm:px-14">
      <h1 className="text-[32px] font-bold tracking-[-0.02em]">Find something to watch</h1>
      <FacetGrid title="Categories" items={categories} href={(f) => `/category/${f.id}`} />
      <FacetGrid
        title="Languages"
        items={languages}
        href={(f) => `/language/${f.id}`}
        label={(f) => nativeLanguageName(f.id, f.name)}
      />
      <FacetGrid title="Countries" items={countries} href={(f) => `/country/${f.id.toLowerCase()}`} />
    </div>
  );
}
