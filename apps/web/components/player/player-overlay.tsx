import type { PlaybackError } from '@/lib/player/attach';
import type { PlayerStatus } from '@/lib/player/state';
import { BlockedIcon, GlobeIcon, OfflineIcon } from '@/components/ui/icons';

// Copy and actions from the "Player states" canvas board. Never a blank black box.
type Kind = 'offline' | 'geo_blocked' | 'browser_blocked' | 'no_stream' | 'closed';
const COPY: Record<Kind, { title: string; body: string; retry: boolean }> = {
  offline: {
    title: 'This channel is offline right now',
    body: "The broadcaster's stream isn't responding.",
    retry: true,
  },
  geo_blocked: {
    title: 'Not available in your region',
    body: 'The broadcaster limits this stream to some countries.',
    retry: false,
  },
  browser_blocked: {
    title: "This stream can't play in a browser",
    body: 'It will work in the Tunely app, coming soon.',
    retry: false,
  },
  no_stream: {
    title: 'No stream available for this channel',
    body: "We don't have a working link for it yet. We check for new streams every day.",
    retry: false,
  },
  closed: {
    title: 'This channel has closed',
    body: 'The broadcaster has stopped this channel.',
    retry: false,
  },
};

export function PlayerOverlay({
  status,
  error,
  channelName,
  onNext,
  onRetry,
  canGoNext,
  deadReason,
}: {
  status: PlayerStatus;
  /** Set when the channel has nothing playable at all; overrides the playback error copy. */
  deadReason?: Kind;
  error: PlaybackError | null;
  channelName: string;
  onNext(): void;
  onRetry(): void;
  canGoNext: boolean;
}) {
  if (status === 'loading') {
    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-3.5 text-[#F2F4F8]"
        data-testid="player-loading"
      >
        <svg
          width="44"
          height="44"
          viewBox="0 0 44 44"
          fill="none"
          aria-hidden="true"
          className="animate-spin"
        >
          <circle cx="22" cy="22" r="18" stroke="#2A3040" strokeWidth="4" />
          <path d="M22 4a18 18 0 0 1 18 18" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <p className="text-base font-semibold">Tuning in to {channelName}…</p>
      </div>
    );
  }
  if (status !== 'error') return null;

  const kind: Kind =
    deadReason ?? (error === 'geo_blocked' || error === 'browser_blocked' ? error : 'offline');
  const copy = COPY[kind];
  const Icon = kind === 'geo_blocked' ? GlobeIcon : kind === 'browser_blocked' ? BlockedIcon : OfflineIcon;
  return (
    <div
      role="alert"
      data-testid={`player-error-${kind}`}
      className="bg-surface text-text absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <Icon size={36} className={kind === 'offline' ? 'text-warning' : 'text-text-muted'} />
      <p className="text-base font-semibold">{copy.title}</p>
      <p className="text-text-muted text-sm">{copy.body}</p>
      <div className="flex gap-2 pt-1">
        {canGoNext && (
          <button
            type="button"
            onClick={onNext}
            className="bg-accent h-11 rounded-[8px] px-[18px] text-sm font-bold text-[#0B0D12]"
          >
            Try next channel
          </button>
        )}
        {copy.retry && (
          <button
            type="button"
            onClick={onRetry}
            className="border-border bg-surface-raised h-11 rounded-[8px] border px-[18px] text-sm font-semibold"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
