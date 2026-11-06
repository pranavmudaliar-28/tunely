'use client';

import { useQueries } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { nativeLanguageName } from '@/lib/format';
import { MAX_LANGUAGES, savePrefs, usePrefs } from '@/lib/prefs';
import { cn } from '@/lib/utils';
import { ChannelRail, RAIL_ITEMS } from './channel-rail';

/** One "Live in {language}" rail per language the viewer picked, best channels first. */
export function YourLanguageRails({ languageNames }: { languageNames: Record<string, string> }) {
  const langs = usePrefs()?.languages ?? [];
  const results = useQueries({
    queries: langs.map((language) => ({
      queryKey: ['language-rail', language],
      queryFn: () => api.channels({ language, status: 'live', sort: 'best', limit: RAIL_ITEMS }),
      staleTime: 10 * 60_000,
      retry: false,
    })),
  });
  return langs.map((l, i) => (
    <ChannelRail
      key={l}
      title={`Live in ${nativeLanguageName(l, languageNames[l] ?? l)}`}
      items={results[i]?.data?.items ?? []}
      seeAllHref={`/language/${l}`}
      languageNames={languageNames}
    />
  ));
}

/** Pick up to MAX_LANGUAGES languages; shared by the first-visit card and the settings page. */
export function LanguagePicker({
  languages,
  picked,
  onChange,
}: {
  languages: { id: string; name: string }[];
  picked: string[];
  onChange(next: string[]): void;
}) {
  const full = picked.length >= MAX_LANGUAGES;
  return (
    <div role="group" aria-label={`Languages, up to ${MAX_LANGUAGES}`} className="flex flex-wrap gap-2">
      {languages.map((l) => {
        const on = picked.includes(l.id);
        return (
          <button
            key={l.id}
            type="button"
            aria-pressed={on}
            disabled={!on && full}
            onClick={() => onChange(on ? picked.filter((p) => p !== l.id) : [...picked, l.id])}
            className={cn(
              'flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold disabled:opacity-40',
              on ? 'bg-text text-bg border-transparent' : 'border-border text-text-muted hover:text-text',
            )}
          >
            {nativeLanguageName(l.id, l.name)}
            {nativeLanguageName(l.id, l.name) !== l.name && (
              <span className={cn('font-normal', on ? 'text-bg/70' : 'text-text-soft')}>{l.name}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** First visit: one skippable question so the home page leads with the viewer's languages. Not a modal. */
export function WelcomeCard({ languages }: { languages: { id: string; name: string }[] }) {
  const prefs = usePrefs();
  const [picked, setPicked] = useState<string[]>([]);
  if (!prefs || prefs.asked || prefs.languages?.length) return null;
  return (
    <section
      aria-labelledby="welcome"
      className="border-border bg-surface mr-4 flex flex-col gap-4 rounded-[12px] border p-5 sm:mr-14"
    >
      <div className="flex flex-col gap-1">
        <h2 id="welcome" className="text-xl font-semibold">
          Which languages do you watch?
        </h2>
        <p className="text-text-muted text-sm">
          Pick up to {MAX_LANGUAGES}. Their live channels move to the top. Saved in this browser only.
        </p>
      </div>
      <LanguagePicker languages={languages} picked={picked} onChange={setPicked} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <button
          type="button"
          disabled={!picked.length}
          onClick={() => savePrefs({ languages: picked, asked: true })}
          className="bg-text text-bg h-11 rounded-[8px] px-5 text-sm font-semibold disabled:opacity-40"
        >
          Show my channels
        </button>
        <button
          type="button"
          onClick={() => savePrefs({ asked: true })}
          className="text-text-muted h-11 text-sm underline"
        >
          Not now
        </button>
        <Link href="/settings" className="text-text-muted text-sm underline">
          Country and more settings
        </Link>
      </div>
    </section>
  );
}
