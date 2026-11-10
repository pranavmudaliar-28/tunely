import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MultiView } from '@/components/multiview/multiview';

export const metadata: Metadata = {
  title: 'Multi-view: watch up to 4 live channels at once',
  description: 'Watch up to four free live TV channels side by side in your browser, with sound from the one you choose.',
  alternates: { canonical: '/multiview' },
};

export default function MultiViewPage() {
  return (
    <Suspense>
      <MultiView />
    </Suspense>
  );
}
