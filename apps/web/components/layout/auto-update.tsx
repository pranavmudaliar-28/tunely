'use client';

import { useEffect } from 'react';

const BUILD = process.env.NEXT_PUBLIC_BUILD_ID;
/** At most one check per this long, however often the app comes back to the front. */
const MIN_GAP_MS = 5 * 60_000;
const TRIED_KEY = 'tunely.update.tried';

/** Mid-programme or mid-sentence: don't pull the page out from under them. */
function busy() {
  const typing = document.activeElement?.closest('input, textarea, select, [contenteditable]');
  const playing = Array.from(document.querySelectorAll('video')).some((v) => !v.paused && !v.ended);
  return Boolean(
    typing || playing || document.pictureInPictureElement || document.querySelector('dialog[open]'),
  );
}

/** Reloads into the new deploy when there is one and nothing is in use. Returns whether it reloaded. */
export async function checkForUpdate(ours: string, reload = () => location.reload()): Promise<boolean> {
  try {
    const res = await fetch('/version', { cache: 'no-store' });
    const { build } = (await res.json()) as { build: string | null };
    if (!build || build === ours || busy()) return false;
    // Once per new deploy: if a misconfigured build never matches, don't reload on every return.
    if (sessionStorage.getItem(TRIED_KEY) === build) return false;
    sessionStorage.setItem(TRIED_KEY, build);
    reload();
    return true;
  } catch {
    return false; // offline, or storage blocked: try again next time
  }
}

/**
 * Installed apps (Android, iOS home screen) load the live site, so a fresh start is always up to date, but phones
 * keep them open in the background for days. When the app comes back to the front, pick up a new deploy.
 */
export function AutoUpdate() {
  useEffect(() => {
    if (!BUILD) return;
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      void checkForUpdate(BUILD);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  return null;
}
