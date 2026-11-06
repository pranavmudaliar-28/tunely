import type { Metadata } from 'next';
import { api } from '@/lib/api-client';
import { SettingsForm } from './settings-form';

export const metadata: Metadata = { title: 'Settings', robots: { index: false } };
export const revalidate = 1800;

export default async function SettingsPage() {
  const [countries, languages] = await Promise.all([
    api.countries().catch(() => []),
    api.languages().catch(() => []),
  ]);
  return (
    <div className="flex flex-col gap-6 px-4 pt-8 pb-16 sm:px-14">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[32px] font-bold tracking-[-0.02em]">Settings</h1>
        <p className="text-text-muted text-[15px]">Saved in this browser only. No account needed.</p>
      </div>
      <SettingsForm
        countries={countries.map(({ id, name }) => ({ id, name }))}
        // The most-watched languages; the rest are reachable from Categories.
        languages={languages.slice(0, 30).map(({ id, name }) => ({ id, name }))}
      />
    </div>
  );
}
