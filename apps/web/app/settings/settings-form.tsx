'use client';

import Link from 'next/link';
import { LanguagePicker } from '@/components/channel/your-languages';
import { MAX_LANGUAGES, savePrefs, usePrefs } from '@/lib/prefs';

type Option = { id: string; name: string };

export function SettingsForm({ countries, languages }: { countries: Option[]; languages: Option[] }) {
  const prefs = usePrefs();
  if (!prefs) return null;
  const sorted = [...countries].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="flex max-w-[720px] flex-col gap-8">
      <section aria-labelledby="s-lang" className="flex flex-col gap-3">
        <div>
          <h2 id="s-lang" className="text-lg font-semibold">
            Your languages
          </h2>
          <p className="text-text-muted text-sm">
            Up to {MAX_LANGUAGES}. Each gets a &quot;Live in …&quot; row at the top of Home.
          </p>
        </div>
        <LanguagePicker
          languages={languages}
          picked={prefs.languages ?? []}
          onChange={(next) => savePrefs({ languages: next, asked: true })}
        />
      </section>

      <section aria-labelledby="s-country" className="flex flex-col gap-3">
        <div>
          <h2 id="s-country" className="text-lg font-semibold">
            Your country
          </h2>
          <p className="text-text-muted text-sm">Home shows what&apos;s popular there.</p>
        </div>
        <label htmlFor="s-country-select" className="sr-only">
          Country
        </label>
        <select
          id="s-country-select"
          value={prefs.country ?? ''}
          onChange={(e) => savePrefs({ country: e.target.value || undefined })}
          className="border-border bg-bg h-11 w-full max-w-[360px] rounded-[8px] border px-2.5 text-sm"
        >
          <option value="">Detect automatically</option>
          {sorted.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </section>

      <section aria-labelledby="s-data" className="flex flex-col gap-2">
        <h2 id="s-data" className="text-lg font-semibold">
          Your data
        </h2>
        <p className="text-text-muted text-sm">
          Favorites, history and these settings stay in this browser. Clearing site data removes them.
        </p>
        <p className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href="/history" className="underline">
            Watch history
          </Link>
          <Link href="/favorites" className="underline">
            Favorites
          </Link>
          <button
            type="button"
            onClick={() => savePrefs({ country: undefined, languages: undefined })}
            className="text-text-muted underline"
          >
            Reset languages and country
          </button>
        </p>
      </section>
    </div>
  );
}
