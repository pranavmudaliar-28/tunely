'use client';

import Link from 'next/link';
import { ChannelCard } from '@/components/channel/channel-card';
import { timeAgo, watchTime } from '@/lib/format';
import { clearHistory, removeFromHistory, useLibrary } from '@/lib/storage/library';

export function HistoryView() {
  const { history } = useLibrary();

  if (!history.length) {
    return (
      <div className="border-border flex flex-col items-center gap-3 rounded-[12px] border p-10 text-center">
        <p className="text-lg font-semibold">Nothing watched yet</p>
        <p className="text-text-muted text-sm">Channels you watch show up here.</p>
        <Link
          href="/browse"
          className="bg-surface-raised text-text mt-2 flex h-11 items-center rounded-[8px] px-5 text-sm font-semibold no-underline"
        >
          Browse channels
        </Link>
      </div>
    );
  }

  const channels = history.map((h) => h.channel);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4 text-sm">
        <span className="text-text-muted">
          {history.length} {history.length === 1 ? 'channel' : 'channels'}
        </span>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Clear your whole watch history in this browser?')) void clearHistory();
          }}
          className="text-text-muted underline"
        >
          Clear history
        </button>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
        {history.map(({ channel, lastWatchedAt, watchSeconds }) => (
          <li key={channel.id} className="flex flex-col gap-1">
            <ChannelCard
              channel={channel}
              lineup={channels}
              variant="grid"
              meta={`${timeAgo(lastWatchedAt)} · ${watchTime(watchSeconds)} in total`}
            />
            <button
              type="button"
              onClick={() => void removeFromHistory(channel.id)}
              aria-label={`Remove ${channel.name} from history`}
              className="text-text-muted hover:text-text self-start px-1 py-2 text-sm underline"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
