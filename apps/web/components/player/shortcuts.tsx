'use client';

import { useEffect, useRef } from 'react';

const OPEN_EVENT = 'tunely:shortcuts';

export const SHORTCUTS: [keys: string, action: string][] = [
  ['↑ / ↓', 'Previous / next channel'],
  ['G', 'Channel list'],
  ['L', 'Last channel you watched'],
  ['1 – 9', 'Your favorites, in order'],
  ['← / →', 'Back / forward 10 seconds (when the stream allows)'],
  ['Space or K', 'Pause / play'],
  ['M', 'Mute'],
  ['F', 'Fullscreen'],
  ['Ctrl / ⌘ + K', 'Search channels'],
  ['?', 'This list'],
];

export const openShortcuts = () => window.dispatchEvent(new Event(OPEN_EVENT));

/** The watch page's "?" sheet. A native modal <dialog> shows above fullscreen video too, and Esc closes it. */
export function ShortcutsDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const open = () => {
      if (!dialog.current?.open) dialog.current?.showModal();
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="shortcuts-title"
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
      className="bg-surface-raised text-text border-border m-auto w-[min(480px,calc(100vw-32px))] rounded-[12px] border p-5 backdrop:bg-black/60"
    >
      <div className="flex items-center justify-between pb-3">
        <h2 id="shortcuts-title" className="text-lg font-semibold">
          Keyboard and remote shortcuts
        </h2>
        <form method="dialog">
          <button type="submit" className="text-text-muted h-11 px-2 text-sm underline">
            Close
          </button>
        </form>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-sm">
        {SHORTCUTS.map(([keys, action]) => (
          <div key={keys} className="contents">
            <dt className="font-semibold whitespace-nowrap">{keys}</dt>
            <dd className="text-text-muted">{action}</dd>
          </div>
        ))}
      </dl>
    </dialog>
  );
}

/** For the watch page, next to "Report a problem". Keyboards only, so hidden on phones. */
export function ShortcutsButton() {
  return (
    <button
      type="button"
      onClick={openShortcuts}
      className="text-text-muted hover:text-text hidden underline underline-offset-2 sm:inline"
    >
      Keyboard shortcuts
    </button>
  );
}
