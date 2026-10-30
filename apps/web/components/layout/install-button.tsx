'use client';

import { useState, useSyncExternalStore } from 'react';
import { CloseIcon, InstallIcon } from '@/components/ui/icons';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Chrome/Edge/Android fire beforeinstallprompt once per page load; keep it here so every Install button (phone
// header and desktop rail) can use it, and so it survives client-side navigation.
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // We show our own button instead of the browser's mini-infobar.
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    emit();
  });
}

type Mode = 'prompt' | 'ios' | null;

function mode(): Mode {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return null;
  if (deferred) return 'prompt';
  // iPhone/iPad Safari has no install prompt: the only way is Share → Add to Home Screen.
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios ? 'ios' : null;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/**
 * "Install" in the nav (or a large "Install Tunely" button on /app): one tap on Chrome/Edge/Android, a how-to on
 * iPhone. Hidden once installed, or where the browser can't install.
 */
export function InstallButton({ variant = 'nav' }: { variant?: 'nav' | 'cta' }) {
  const current = useSyncExternalStore(subscribe, mode, () => null);
  const [help, setHelp] = useState(false);
  if (!current) return null;

  const install = async () => {
    if (current === 'ios') return setHelp(true);
    const event = deferred;
    if (!event) return;
    await event.prompt();
    await event.userChoice.catch(() => null);
    deferred = null; // A prompt can only be used once.
    emit();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void install()}
        aria-label="Install Tunely as an app"
        className={
          variant === 'cta'
            ? 'bg-text text-bg flex h-12 w-fit items-center gap-2 rounded-[8px] px-6 text-[15px] font-bold'
            : 'text-text-muted hover:text-text flex min-h-11 w-16 flex-col items-center justify-center gap-1 rounded-[10px] py-2 text-[11px] font-medium min-[720px]:w-[72px]'
        }
      >
        <InstallIcon size={variant === 'cta' ? 20 : 22} />
        {variant === 'cta' ? 'Install Tunely' : 'Install'}
      </button>
      {help && (
        <div
          role="dialog"
          aria-label="Install Tunely on iPhone"
          onKeyDown={(e) => e.key === 'Escape' && setHelp(false)}
          className="border-border bg-surface-raised fixed inset-x-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 flex items-start gap-3 rounded-[12px] border p-4 shadow-2xl shadow-black/60 min-[720px]:left-auto min-[720px]:w-[360px]"
        >
          <p className="text-text grow text-sm leading-relaxed">
            To install Tunely, tap the <strong>Share</strong> button in Safari, then{' '}
            <strong>Add to Home Screen</strong>.
          </p>
          <button
            type="button"
            autoFocus
            onClick={() => setHelp(false)}
            aria-label="Close"
            className="text-text-muted hover:text-text flex size-11 shrink-0 items-center justify-center rounded-[8px]"
          >
            <CloseIcon size={18} />
          </button>
        </div>
      )}
    </>
  );
}
