'use client';

import { addReminder } from '@/lib/reminder';
import { nowAndNext, timeLeft, useClock, type Slot } from '@/lib/schedule';
import { SITE_URL } from '@/lib/site';

/** "Now: The Morning Show" when a programme is on (the viewer's clock), else `fallback`: one line either way. */
export function OnNow({ onAir, fallback }: { onAir: Pick<Slot, 'title' | 'start' | 'stop'>[]; fallback: string }) {
  const now = useClock();
  const current = now === null ? undefined : nowAndNext(onAir, now).current;
  return <>{current ? `Now: ${current.title}` : fallback}</>;
}

const clock = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(Date.parse(iso));

/**
 * "Now: The Morning Show · 23 min left" and "Next 10:30 · News", from the channel's guide. Drawn in the browser (the
 * viewer's clock and time zone); its height is reserved so nothing below jumps when it appears.
 */
export function NowNext({
  schedule,
  channel,
  label = 'On this channel',
}: {
  schedule: Pick<Slot, 'title' | 'start' | 'stop'>[];
  /** Offers "Remind me" for the next programme. */
  channel?: { id: string; name: string };
  label?: string;
}) {
  const now = useClock();
  if (!schedule.length) return null;
  const { current, next } = now === null ? {} : nowAndNext(schedule, now);
  const progress =
    current && now !== null
      ? (now - Date.parse(current.start)) / (Date.parse(current.stop) - Date.parse(current.start))
      : 0;
  return (
    <section
      aria-label={label}
      className="flex min-h-[52px] max-w-[720px] flex-col gap-1.5 text-[15px]"
    >
      {current && now !== null && (
        <>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-text-muted text-[13px] font-medium">Now</span>
            <span className="font-semibold">{current.title}</span>
            <span className="text-text-muted text-[13px]">· {timeLeft(current.stop, now)}</span>
          </p>
          <div
            aria-hidden="true"
            className="bg-surface-raised h-1 w-full max-w-[320px] overflow-hidden rounded-full"
          >
            <div className="bg-text-muted h-full" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </>
      )}
      {next && (
        <p className="text-text-muted flex flex-wrap items-center gap-x-2 text-[13px]">
          <span>
            Next {clock(next.start)} · <span className="text-text">{next.title}</span>
          </span>
          {channel && (
            <button
              type="button"
              onClick={() =>
                addReminder({
                  channelId: channel.id,
                  channelName: channel.name,
                  ...next,
                  url: `${SITE_URL}/watch/${encodeURIComponent(channel.id)}`,
                })
              }
              aria-label={`Remind me: ${next.title} at ${clock(next.start)}`}
              className="text-text hover:bg-surface-raised -my-1 min-h-8 rounded-[6px] px-2 font-medium underline-offset-2 hover:underline"
            >
              Remind me
            </button>
          )}
        </p>
      )}
    </section>
  );
}
