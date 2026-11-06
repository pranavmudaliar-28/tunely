'use client';

import { nowAndNext, timeLeft, useClock, type Slot } from '@/lib/schedule';

const clock = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(Date.parse(iso));

/**
 * "Now: The Morning Show · 23 min left" and "Next 10:30 · News", from the channel's guide. Drawn in the browser (the
 * viewer's clock and time zone); its height is reserved so nothing below jumps when it appears.
 */
export function NowNext({ schedule }: { schedule: Slot[] }) {
  const now = useClock();
  if (!schedule.length) return null;
  const { current, next } = now === null ? {} : nowAndNext(schedule, now);
  const progress =
    current && now !== null
      ? (now - Date.parse(current.start)) / (Date.parse(current.stop) - Date.parse(current.start))
      : 0;
  return (
    <section
      aria-label="On this channel"
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
        <p className="text-text-muted text-[13px]">
          Next {clock(next.start)} · <span className="text-text">{next.title}</span>
        </p>
      )}
    </section>
  );
}
