import type { Metadata } from 'next';
import { HistoryView } from './history-view';

export const metadata: Metadata = { title: 'Watch history', robots: { index: false } };

export default function HistoryPage() {
  return (
    <div className="flex flex-col gap-6 px-4 pt-8 pb-16 sm:px-14">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[32px] font-bold tracking-[-0.02em]">Watch history</h1>
        <p className="text-text-muted text-[15px]">Saved in this browser only. Remove anything, any time.</p>
      </div>
      <HistoryView />
    </div>
  );
}
