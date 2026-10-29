import { jsonLdString } from '@/lib/seo';

/** Structured data for search engines (rich results). */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
