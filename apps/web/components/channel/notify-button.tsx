'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  notifyBefore,
  notifyWhenBack,
  pushConfigured,
  pushIsOn,
  pushOff,
  pushSupported,
  type PushResult,
} from '@/lib/push';
import { cn } from '@/lib/utils';

const noop = () => () => {};
/** False on the server and during hydration; the buttons only appear where push works. */
const useSupported = () => useSyncExternalStore(noop, pushSupported, () => false);

const MESSAGES: Record<Exclude<PushResult, 'ok'>, string> = {
  denied: 'Notifications are blocked for this site in your browser settings.',
  'live now': 'It is live right now.',
  'too many': 'You already have the most notifications we keep for one browser.',
  error: "That didn't work. Try again in a moment.",
};

function useAsk(run: () => Promise<PushResult>) {
  const [state, setState] = useState<'idle' | 'busy' | PushResult>('idle');
  const go = async () => {
    setState('busy');
    setState(await run());
  };
  return { state, go, message: state !== 'idle' && state !== 'busy' && state !== 'ok' ? MESSAGES[state] : null };
}

/** On an offline channel's page: one notification when it plays again. */
export function NotifyWhenBack({ channelId }: { channelId: string }) {
  const supported = useSupported();
  const { state, go, message } = useAsk(() => notifyWhenBack(channelId));
  if (!supported) return null;
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={go}
        disabled={state === 'busy' || state === 'ok'}
        className="bg-surface-raised text-text flex h-12 items-center rounded-[8px] px-[18px] text-[15px] font-semibold disabled:opacity-70"
      >
        {state === 'ok' ? "We'll tell you when it's back" : state === 'busy' ? 'Turning on…' : 'Notify me when it’s back'}
      </button>
      <p role="status" className="text-text-muted text-[13px]">
        {message}
      </p>
    </div>
  );
}

/** Beside "Remind me": a notification on this device 5 minutes before the programme. */
export function NotifyBefore({ channelId, start, title }: { channelId: string; start: string; title: string }) {
  const supported = useSupported();
  const { state, go, message } = useAsk(() => notifyBefore(channelId, start));
  if (!supported) return null;
  return (
    <>
      <button
        type="button"
        onClick={go}
        disabled={state === 'busy' || state === 'ok'}
        aria-label={state === 'ok' ? `Notification set for ${title}` : `Notify me before ${title}`}
        className={cn(
          'text-text hover:bg-surface-raised -my-1 min-h-8 rounded-[6px] px-2 font-medium underline-offset-2 hover:underline',
          state === 'ok' && 'no-underline',
        )}
      >
        {state === 'ok' ? 'Notification set' : state === 'busy' ? 'Turning on…' : 'Notify me'}
      </button>
      {message && (
        <span role="status" className="text-text-muted basis-full">
          {message}
        </span>
      )}
    </>
  );
}

/** Settings: whether this browser has notifications on, and a way to turn them all off. */
export function PushSettings() {
  const supported = useSupported();
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!supported) return;
    let current = true;
    void pushIsOn().then((v) => current && setOn(v));
    return () => {
      current = false;
    };
  }, [supported]);
  if (!pushConfigured()) return null;
  return (
    <section aria-labelledby="s-push" className="flex flex-col gap-2">
      <h2 id="s-push" className="text-lg font-semibold">
        Notifications
      </h2>
      <p className="text-text-muted text-sm" role="status">
        {!supported
          ? "This browser can't show notifications from Tunely. On iPhone and iPad, add Tunely to your Home Screen first."
          : on
            ? 'On in this browser, only for the channels and programmes you asked about.'
            : 'Off. Turn them on with “Notify me when it’s back” on an offline channel, or “Notify me” in the guide.'}
      </p>
      {supported && on && (
        <p>
          <button
            type="button"
            onClick={async () => {
              await pushOff();
              setOn(false);
            }}
            className="text-text-muted text-sm underline"
          >
            Turn off and forget what I asked for
          </button>
        </p>
      )}
    </section>
  );
}
